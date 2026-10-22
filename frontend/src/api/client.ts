import { z } from "zod";
import {
  attestationSchema, proposalSchema, settlementSchema, sliceSchema,
  verificationSchema, vaultSchema,
  type ExchangeApi, type Attestation, type Proposal, type Role,
  type SignatureRequest, type Settlement, type Slice, type CreditEntry,
} from "./contracts";
import { createMockApi } from "../mocks/fixtures";
import { ApiError, messages } from "./errors";
import { createLiveAccess, PaymentRequiredError } from "./access";
import { analysisResponseSchema, presentAnalytics } from "./analytics";
import { signCanonical } from "./signing";
export { ApiError } from "./errors";

export function resolveMode(env: Record<string, string | boolean | undefined>): "mock" | "live" {
  if (env.VITE_DATA_MODE !== undefined) {
    if (env.VITE_DATA_MODE !== "mock" && env.VITE_DATA_MODE !== "live")
      throw new Error("VITE_DATA_MODE must be mock or live.");
    return env.VITE_DATA_MODE;
  }
  if (env.VITE_USE_MOCK !== undefined && env.VITE_USE_MOCK !== "true" && env.VITE_USE_MOCK !== "false")
    throw new Error("VITE_USE_MOCK must be true or false.");
  return env.VITE_USE_MOCK === "false" ? "live" : "mock";
}

const catalogSchema = z.array(sliceSchema).refine(list => new Set(list.map(slice => slice.slice_id)).size === list.length);
const challengeSchema = z.object({ nonce: z.string(), canonical_message: z.string(), expires_at: z.string() });
const redemptionSchema = z.object({ slice_id: z.string(), download_token: z.string(), expires_at: z.string().nullable(), staker_balance: z.number().finite().nonnegative() });
const balanceSchema = z.object({ address: z.string(), staker_balance: z.number().finite().nonnegative() });
interface Grant { token: string; expiresAt?: string | null }

export function createLiveApi(base = "http://localhost:8000/api/v1", initialLab = "lab_synthesis"): ExchangeApi {
  let lab = initialLab;
  let catalog: Slice[] = [];
  const attestations = new Map<string, Attestation>();
  const proposals = new Map<string, Proposal>();
  const approvals = new Map<string, Map<Role, SignatureRequest>>();
  const grants = new Map<string, Grant>();
  const ownerCredentials = new Map<string, Record<string, string>>();
  let entries: CreditEntry[] = [];
  let sequence = 0;
  const transport = createLiveAccess(base);

  async function request<T>(path: string, schema: z.ZodType<T>, body?: unknown, headers?: Record<string, string>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? headers : { "Content-Type": "application/json", ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal, redirect: "error", credentials: "omit", cache: "no-store",
      });
      if (!response.ok) {
        let detail: string | undefined;
        try {
          const rejected = await response.json();
          if (typeof rejected?.message === "string") detail = rejected.message;
        } catch { /* Non-JSON server errors retain the status-specific description. */ }
        throw new ApiError(detail || messages[response.status] || `Request failed (HTTP ${response.status}).`, response.status);
      }
      let envelope: unknown;
      try { envelope = await response.json(); }
      catch { throw new ApiError("Malformed response: expected JSON."); }
      const wrapped = z.object({ code: z.number(), data: z.unknown() }).safeParse(envelope);
      if (!wrapped.success) throw new ApiError("Malformed API response envelope.");
      if (wrapped.data.code !== 200)
        throw new ApiError(messages[wrapped.data.code] || `Backend rejected the operation (${wrapped.data.code}).`, wrapped.data.code);
      const parsed = schema.safeParse(wrapped.data.data);
      if (!parsed.success) throw new ApiError("Backend response does not match the documented frontend contract.");
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted
        ? "Request timed out. Check the backend connection and retry."
        : "Cannot reach the backend. Check the service URL, network and CORS settings.");
    } finally { clearTimeout(timer); }
  }
  async function refreshCatalog() {
    catalog = await request("/slices?include_quarantined=true", catalogSchema);
    return catalog;
  }
  function token(id: string) {
    const grant = grants.get(id);
    if (grant?.expiresAt && Date.parse(grant.expiresAt) <= Date.now()) {
      grants.delete(id);
      return undefined;
    }
    return grant?.token;
  }
  function ownerHeaders(id: string) {
    const headers = ownerCredentials.get(id);
    if (headers && Date.parse(headers["X-PI-Expires-At"]) <= Date.now()) {
      ownerCredentials.delete(id);
      return undefined;
    }
    return headers;
  }
  function rememberGrant(value: Settlement) {
    if (value.download_token && value.downloaded_slice_id)
      grants.set(value.downloaded_slice_id, { token: value.download_token, expiresAt: value.expires_at });
  }
  async function poll(id: string, signerAddress?: string): Promise<Settlement> {
    if (signerAddress && signerAddress !== lab)
      throw new ApiError("Restore access for the active laboratory only.");
    const status = await request(`/barter/proposals/${encodeURIComponent(id)}`, settlementSchema);
    if (status.status === "DUAL_SIGNED_AND_EXECUTED" && !status.expired) {
      const proofs = [...(approvals.get(id)?.values() || [])]
        .filter(signed => !signerAddress || signed.signer_address === signerAddress);
      if (signerAddress && !proofs.length)
        throw new ApiError("An approved PI signature is required to restore this access.");
      for (const signed of proofs) {
        const own = await request(`/barter/proposals/${encodeURIComponent(id)}`, settlementSchema, undefined,
          { "X-PI-Address": signed.signer_address, "X-PI-Signature": signed.signature });
        rememberGrant(own);
      }
    }
    return status;
  }
  async function wallet() {
    const response = await request(`/vault/balance?address=${encodeURIComponent(lab)}`, balanceSchema);
    if (response.address !== lab) throw new ApiError("Wallet response references a different laboratory.");
    return { balance: response.staker_balance, entries: [...entries] };
  }
  async function signedVault(action: "deposit" | "redeem", id: string, address: string) {
    const challenge = await request("/vault/challenge", challengeSchema,
      { action, slice_id: id, staker_address: address });
    const signature = await signCanonical(address, challenge.canonical_message,
      action === "deposit" ? "Approve failed-data deposit" : "Approve SciCredit purchase");
    return { slice_id: id, staker_address: address, nonce: challenge.nonce, signature };
  }
  async function access(id: string, renewOwnerAuthorization = false) {
    const isOwner = catalog.find(slice => slice.slice_id === id)?.owner_lab_id === lab;
    const renewOwner = renewOwnerAuthorization && isOwner;
    const proof = renewOwner ? undefined : token(id);
    let headers = renewOwner ? undefined : ownerHeaders(id);
    if (!proof && !headers && isOwner) {
      const expiresAt = new Date(Date.now() + 4 * 60 * 1000).toISOString();
      // Keys are sorted exactly like the gateway's canonical_json function.
      const canonical = JSON.stringify({ action: "owner_read", expires_at: expiresAt, owner_lab_id: lab,
        protocol: "SciExchange/v4", slice_id: id });
      const signature = await signCanonical(lab, canonical, "Authorize access to your scientific slice");
      headers = { "X-PI-Address": lab, "X-PI-Signature": signature, "X-PI-Expires-At": expiresAt };
      ownerCredentials.set(id, headers);
    }
    const response = await transport.access(id, proof, headers);
    if (response.kind === "payment_required") {
      grants.delete(id);
      ownerCredentials.delete(id);
    }
    return response;
  }
  return {
    mode: "live", getLab: () => lab,
    setLab: (address) => {
      if (address === lab) return;
      lab = address; entries = []; grants.clear(); ownerCredentials.clear();
    },
    wallet, catalog: refreshCatalog, access, poll,
    verify: async (input) => {
      const result = await request("/compiler/verify", verificationSchema, input);
      const attestation = attestationSchema.safeParse(result);
      if (result.valid && attestation.success) attestations.set(result.slice_id, attestation.data);
      else attestations.delete(result.slice_id);
      catalog = catalog.map(slice => slice.slice_id === result.slice_id
        ? { ...slice, is_attested: result.valid, attestation_uid: result.attestation_uid,
            quarantined: result.safety_alerts.length > 0 } : slice);
      return result;
    },
    attestation: async (id) => {
      const saved = attestations.get(id);
      if (saved) return saved;
      const response = await request(`/slices/${encodeURIComponent(id)}/attestation`, attestationSchema);
      if (response.slice_id !== id) throw new ApiError("Attestation response references a different slice.");
      attestations.set(id, response);
      return response;
    },
    propose: async (input) => {
      if (!catalog.length) await refreshCatalog();
      const offered = catalog.find(slice => slice.slice_id === input.offered_slice_id);
      const requested = catalog.find(slice => slice.slice_id === input.requested_slice_id);
      const partyA = input.party_a_lab || offered?.owner_lab_id;
      const partyB = input.party_b_lab || requested?.owner_lab_id;
      if (!partyA || !partyB) throw new ApiError("Both slices must declare their owning laboratories.");
      const proposal = await request("/barter/negotiate", proposalSchema, {
        party_a_lab: partyA, party_a_slice_id: input.offered_slice_id,
        party_b_lab: partyB, party_b_slice_id: input.requested_slice_id,
      });
      proposals.set(proposal.proposal_id, proposal);
      return proposal;
    },
    sign: async (id, role, supplied) => {
      let signed = supplied;
      if (!signed) {
        const proposal = proposals.get(id) || await request(`/barter/proposals/${encodeURIComponent(id)}`, proposalSchema);
        const address = role === "pi_proposer" ? proposal.party_a_lab : proposal.party_b_lab;
        if (!address || !proposal.canonical_agreement)
          throw new ApiError("The backend did not provide an agreement-bound signing message.");
        signed = { signer_role: role, signer_address: address,
          signature: await signCanonical(address, proposal.canonical_agreement, "Approve reciprocal scientific data exchange") };
        proposals.set(id, proposal);
      }
      if (signed.signer_role !== role) throw new ApiError("Signature role does not match this approval.");
      // A lost response does not mean the server rejected this signature.
      // Retain it for authenticated status recovery; only the server confirms approval.
      const known = approvals.get(id) || new Map<Role, SignatureRequest>();
      known.set(role, signed); approvals.set(id, known);
      let response: Settlement;
      try {
        response = await request("/barter/dual-sign", settlementSchema, { proposal_id: id, ...signed });
      } catch (error) {
        if (error instanceof ApiError && error.status !== undefined && error.status >= 400 && error.status < 500)
          known.delete(role);
        throw error;
      }
      if (["PENDING_SECOND_PI_SIGNATURE", "DUAL_SIGNED_AND_EXECUTED"].includes(response.status)) {
        rememberGrant(response);
      } else known.delete(role);
      return response.proposal_id ? poll(id) : response;
    },
    analytics: async (domain) => {
      if (!catalog.length) await refreshCatalog();
      const slice = catalog.find(item => item.domain === domain && item.is_attested && !item.quarantined &&
        (token(item.slice_id) || ownerHeaders(item.slice_id)));
      if (!slice) throw new ApiError("Analysis is locked. Complete an exchange, purchase data, or authorize owner access first. No simulated results are shown in live mode.", 402);
      const proof = token(slice.slice_id);
      const headers = proof ? { Authorization: `Bearer ${proof}` } : ownerHeaders(slice.slice_id);
      const delivery = await transport.access(slice.slice_id, proof, ownerHeaders(slice.slice_id));
      if (delivery.kind === "payment_required") throw new PaymentRequiredError(delivery);
      if (!delivery.document) throw new ApiError("Analysis requires a complete scientific document from the gateway.");
      const types = domain === "electrocatalysis" ? ["tafel_slope", "dta"] : ["dq_dv", "knee_point"];
      const results: Record<string, unknown> = {};
      for (const analysisType of types) {
        const response = await request("/analysis", analysisResponseSchema,
          { slice_id: slice.slice_id, analysis_type: analysisType }, headers);
        if (response.slice_id !== slice.slice_id || response.analysis_type !== analysisType)
          throw new ApiError("Analysis response references a different slice or method.");
        results[analysisType] = response.result;
      }
      return presentAnalytics(delivery.document, results);
    },
    stake: async (input) => {
      const address = input.staker_address || lab;
      const before = address === lab ? (await wallet()).balance : undefined;
      const body = await signedVault("deposit", input.slice_id, address);
      const result = await request("/vault/deposit", vaultSchema, body);
      if (before !== undefined && result.staker_balance > before)
        entries.push({ id: `deposit_${++sequence}`, kind: "stake", amount: result.staker_balance - before, sliceId: input.slice_id });
      return result;
    },
    purchase: async (input) => {
      if (input.receipt) {
        const result = await transport.purchase(input);
        grants.set(input.sliceId, { token: input.receipt });
        return result;
      }
      const before = await wallet();
      const body = await signedVault("redeem", input.sliceId, lab);
      const result = await request("/vault/redeem", redemptionSchema, body);
      if (result.slice_id !== input.sliceId) throw new ApiError("Redemption references a different slice.");
      grants.set(input.sliceId, { token: result.download_token, expiresAt: result.expires_at });
      if (before.balance !== result.staker_balance)
        entries.push({ id: `purchase_${++sequence}`, kind: "purchase", amount: result.staker_balance - before.balance, sliceId: input.sliceId });
      const delivery = await transport.access(input.sliceId, result.download_token);
      if (delivery.kind === "payment_required") throw new PaymentRequiredError(delivery);
      return { delivery, wallet: { balance: result.staker_balance, entries: [...entries] } };
    },
    reset: async () => {
      // A live workspace reset clears browser-held state only; server records remain intact.
      catalog = []; attestations.clear(); proposals.clear(); approvals.clear(); grants.clear(); ownerCredentials.clear(); entries = [];
    },
  };
}
export const api: ExchangeApi = resolveMode(import.meta.env) === "mock" ? createMockApi()
  : createLiveApi(import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_LAB_ID || "lab_synthesis");
