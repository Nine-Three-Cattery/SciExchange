import { z } from "zod";
import {
  attestationSchema, proposalSchema, settlementSchema, sliceSchema,
  verificationSchema, vaultSchema, applyVerification, isEligible, isRejected,
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
const reviewChallengeSchema = z.object({ slice_id: z.string(), version: z.string(), canonical_message: z.string(), expires_at: z.string() });
const admissionMessageSchema = z.object({
  protocol: z.literal("SciExchange/scientific-admission/1"), action: z.literal("scientific_admission"),
  slice_id: z.string(), version: z.string(), owner_lab_id: z.string(), expires_at: z.string(),
  input_sha256: z.string().regex(/^[a-f0-9]{64}$/), report_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  rule_version: z.string().min(1),
});
const redemptionSchema = z.object({ slice_id: z.string(), download_token: z.string(), expires_at: z.string().nullable(), staker_balance: z.number().finite().nonnegative() });
const balanceSchema = z.object({ address: z.string(), staker_balance: z.number().finite().nonnegative() });
interface Grant { token: string; expiresAt?: string | null }
interface CachedApproval { signature: SignatureRequest; generation: number }

export function createLiveApi(base = "http://localhost:8000/api/v1", initialLab = "lab_synthesis"): ExchangeApi {
  let lab = initialLab;
  let catalog: Slice[] = [];
  const attestations = new Map<string, Attestation>();
  const proposals = new Map<string, Proposal>();
  const approvals = new Map<string, Map<Role, CachedApproval>>();
  const grants = new Map<string, Grant>();
  const ownerCredentials = new Map<string, Record<string, string>>();
  let entries: CreditEntry[] = [];
  let sequence = 0;
  let identityGeneration = 0;
  const transport = createLiveAccess(base);

  function checkIdentity() {
    const generation = identityGeneration;
    return () => {
      if (generation !== identityGeneration)
        throw new ApiError("The active laboratory changed. Retry the operation in the current session.");
    };
  }

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
    const current = await request("/slices?include_quarantined=true", catalogSchema);
    for (const [id, proof] of attestations) {
      const before = catalog.find(slice => slice.slice_id === id);
      const next = current.find(slice => slice.slice_id === id);
      if (!next || !isEligible(next) || next.attestation_uid !== proof.attestation_uid || before?.version !== next.version)
        attestations.delete(id);
    }
    catalog = current;
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
  function checkedSettlement(id: string, value: Settlement) {
    if (value.proposal_id !== id)
      throw new ApiError("Settlement response references a different or missing proposal.");
    if (["SWAP_COMPLETED", "DUAL_SIGNED_AND_EXECUTED"].includes(value.status) &&
        !value.expired && (value.proposer_signed === false || value.target_signed === false))
      throw new ApiError("Settlement response contradicts the required bilateral PI signatures.");
    return value;
  }
  async function poll(id: string, signerAddress?: string): Promise<Settlement> {
    const assertCurrentIdentity = checkIdentity();
    if (signerAddress && signerAddress !== lab)
      throw new ApiError("Restore access for the active laboratory only.");
    const status = checkedSettlement(id, await request(`/barter/proposals/${encodeURIComponent(id)}`, settlementSchema));
    assertCurrentIdentity();
    if (status.status === "DUAL_SIGNED_AND_EXECUTED" && !status.expired) {
      const proofs = [...(approvals.get(id)?.values() || [])]
        // Older signatures are retained for explicit restoration by their own
        // active lab, never for automatic polling in another identity session.
        .filter(cached => signerAddress ? cached.signature.signer_address === signerAddress
          : cached.generation === identityGeneration)
        .map(cached => cached.signature);
      if (signerAddress && !proofs.length)
        throw new ApiError("An approved PI signature is required to restore this access.");
      for (const signed of proofs) {
        const own = await request(`/barter/proposals/${encodeURIComponent(id)}`, settlementSchema, undefined,
          { "X-PI-Address": signed.signer_address, "X-PI-Signature": signed.signature });
        assertCurrentIdentity();
        checkedSettlement(id, own);
        rememberGrant(own);
      }
    }
    return status;
  }
  async function wallet() {
    const assertCurrentIdentity = checkIdentity();
    const response = await request(`/vault/balance?address=${encodeURIComponent(lab)}`, balanceSchema);
    assertCurrentIdentity();
    if (response.address !== lab) throw new ApiError("Wallet response references a different laboratory.");
    return { balance: response.staker_balance, entries: [...entries] };
  }
  async function signedVault(action: "deposit" | "redeem", id: string, address: string) {
    const assertCurrentIdentity = checkIdentity();
    const challenge = await request("/vault/challenge", challengeSchema,
      { action, slice_id: id, staker_address: address });
    assertCurrentIdentity();
    const signature = await signCanonical(address, challenge.canonical_message,
      action === "deposit" ? "Approve failed-data deposit" : "Approve SciCredit purchase");
    assertCurrentIdentity();
    return { slice_id: id, staker_address: address, nonce: challenge.nonce, signature };
  }
  async function access(id: string, renewOwnerAuthorization = false) {
    const assertCurrentIdentity = checkIdentity();
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
      assertCurrentIdentity();
      headers = { "X-PI-Address": lab, "X-PI-Signature": signature, "X-PI-Expires-At": expiresAt };
      ownerCredentials.set(id, headers);
    }
    const response = await transport.access(id, proof, headers);
    assertCurrentIdentity();
    if (response.kind === "payment_required") {
      grants.delete(id);
      ownerCredentials.delete(id);
    }
    return response;
  }
  function rememberVerification(result: z.infer<typeof verificationSchema>) {
    const attestation = attestationSchema.safeParse(result);
    if (!isRejected(result) && (result.is_attested ?? result.valid) && attestation.success) attestations.set(result.slice_id, attestation.data);
    else attestations.delete(result.slice_id);
    catalog = catalog.map(slice => slice.slice_id === result.slice_id ? applyVerification(slice, result) : slice);
    return result;
  }
  return {
    mode: "live", getLab: () => lab,
    setLab: (address) => {
      if (address === lab) return;
      identityGeneration++;
      lab = address; entries = []; grants.clear(); ownerCredentials.clear();
    },
    wallet, catalog: refreshCatalog, access, poll,
    verify: async (input) => {
      const result = await request("/compiler/verify", verificationSchema, input);
      if (result.slice_id !== input.slice_id || (input.version && result.version !== input.version))
        throw new ApiError("Verification response references a different slice or version.");
      return rememberVerification(result);
    },
    review: async (id) => {
      const assertCurrentIdentity = checkIdentity();
      const currentLab = lab;
      if (!catalog.length) await refreshCatalog();
      assertCurrentIdentity();
      const slice = catalog.find(item => item.slice_id === id);
      if (!slice?.version || slice.owner_lab_id !== currentLab || slice.quarantined || slice.compiler_status === "REJECTED")
        throw new ApiError("Only the owning laboratory can approve an unquarantined scientific slice.");
      const challenge = await request("/compiler/review-challenge", reviewChallengeSchema, { slice_id: id, version: slice.version });
      assertCurrentIdentity();
      let message: z.infer<typeof admissionMessageSchema>;
      try { message = admissionMessageSchema.parse(JSON.parse(challenge.canonical_message)); }
      catch { throw new ApiError("The scientific admission challenge is malformed."); }
      if (challenge.slice_id !== id || challenge.version !== slice.version || message.slice_id !== id ||
          message.version !== slice.version || message.owner_lab_id !== currentLab || message.expires_at !== challenge.expires_at)
        throw new ApiError("The scientific admission challenge references a different slice, version, laboratory or expiry.");
      const signature = await signCanonical(currentLab, challenge.canonical_message, "Approve scientific data admission");
      assertCurrentIdentity();
      const result = await request("/compiler/review", verificationSchema, {
        slice_id: id, version: slice.version, signer_address: currentLab, signature, expires_at: challenge.expires_at,
      });
      assertCurrentIdentity();
      if (result.slice_id !== id || result.version !== slice.version)
        throw new ApiError("Admission response references a different slice or version.");
      if (!isEligible(slice, result) || result.review_status !== "approved")
        throw new ApiError("The backend did not confirm scientific admission.");
      return rememberVerification(result);
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
      const assertCurrentIdentity = checkIdentity();
      let signed = supplied;
      if (!signed) {
        const proposal = proposals.get(id) || await request(`/barter/proposals/${encodeURIComponent(id)}`, proposalSchema);
        assertCurrentIdentity();
        const address = role === "pi_proposer" ? proposal.party_a_lab : proposal.party_b_lab;
        if (!address || !proposal.canonical_agreement)
          throw new ApiError("The backend did not provide an agreement-bound signing message.");
        signed = { signer_role: role, signer_address: address,
          signature: await signCanonical(address, proposal.canonical_agreement, "Approve reciprocal scientific data exchange") };
        assertCurrentIdentity();
        proposals.set(id, proposal);
      }
      if (signed.signer_role !== role) throw new ApiError("Signature role does not match this approval.");
      // A lost response does not mean the server rejected this signature.
      // Retain it for authenticated status recovery; only the server confirms approval.
      const known = approvals.get(id) || new Map<Role, CachedApproval>();
      const cached = { signature: signed, generation: identityGeneration };
      known.set(role, cached); approvals.set(id, known);
      let response: Settlement;
      try {
        response = checkedSettlement(id, await request("/barter/dual-sign", settlementSchema, { proposal_id: id, ...signed }));
      } catch (error) {
        if (error instanceof ApiError && error.status !== undefined && error.status >= 400 && error.status < 500 && known.get(role) === cached)
          known.delete(role);
        throw error;
      }
      assertCurrentIdentity();
      if (["PENDING_SECOND_PI_SIGNATURE", "DUAL_SIGNED_AND_EXECUTED"].includes(response.status)) {
        rememberGrant(response);
      } else if (known.get(role) === cached) known.delete(role);
      const status = response.proposal_id ? await poll(id) : response;
      assertCurrentIdentity();
      return status;
    },
    analytics: async (domain, sliceId) => {
      const assertCurrentIdentity = checkIdentity();
      if (!catalog.length) await refreshCatalog();
      assertCurrentIdentity();
      const slice = catalog.find(item => item.domain === domain && (!sliceId || item.slice_id === sliceId) &&
        item.analysis_methods?.length !== 0 && isEligible(item) &&
        (token(item.slice_id) || ownerHeaders(item.slice_id)));
      if (!slice) throw new ApiError("Analysis is locked. Complete an exchange, purchase data, or authorize owner access first. No simulated results are shown in live mode.", 402);
      const proof = token(slice.slice_id);
      const headers = proof ? { Authorization: `Bearer ${proof}` } : ownerHeaders(slice.slice_id);
      const delivery = await transport.access(slice.slice_id, proof, ownerHeaders(slice.slice_id));
      assertCurrentIdentity();
      if (delivery.kind === "payment_required") throw new PaymentRequiredError(delivery);
      if (!delivery.document) throw new ApiError("Analysis requires a complete scientific document from the gateway.");
      if (delivery.document.domain !== slice.domain)
        throw new ApiError("Delivered data references a different scientific domain.");
      if (slice.version && delivery.document.version !== slice.version)
        throw new ApiError("Delivered data references a different scientific version.");
      const types = slice.analysis_methods ?? (domain === "electrocatalysis" ? ["tafel_slope", "dta"] : ["dq_dv", "knee_point"]);
      if (!types.length) throw new ApiError("No supported analysis is declared for this scientific slice.");
      const results: Record<string, unknown> = {};
      for (const analysisType of types) {
        const response = await request("/analysis", analysisResponseSchema,
          { slice_id: slice.slice_id, analysis_type: analysisType,
            ...(slice.version ? { version: slice.version } : {}),
            ...(slice.version && analysisType === "tafel_slope" ? { parameters: { current_min: 0.3, current_max: 10 } } : {}),
          }, headers);
        assertCurrentIdentity();
        if (slice.version && response.version !== slice.version)
          throw new ApiError("Analysis response references a different or missing scientific version.");
        if (response.slice_id !== slice.slice_id || response.analysis_type !== analysisType)
          throw new ApiError("Analysis response references a different slice or method.");
        results[analysisType] = response.result;
      }
      return presentAnalytics(delivery.document, results);
    },
    stake: async (input) => {
      const assertCurrentIdentity = checkIdentity();
      const address = input.staker_address || lab;
      const before = address === lab ? (await wallet()).balance : undefined;
      assertCurrentIdentity();
      const body = await signedVault("deposit", input.slice_id, address);
      assertCurrentIdentity();
      const result = await request("/vault/deposit", vaultSchema, body);
      assertCurrentIdentity();
      if (before !== undefined && result.staker_balance > before)
        entries.push({ id: `deposit_${++sequence}`, kind: "stake", amount: result.staker_balance - before, sliceId: input.slice_id });
      return result;
    },
    purchase: async (input) => {
      const assertCurrentIdentity = checkIdentity();
      if (input.receipt) {
        const result = await transport.purchase(input);
        assertCurrentIdentity();
        grants.set(input.sliceId, { token: input.receipt });
        return result;
      }
      const before = await wallet();
      assertCurrentIdentity();
      const body = await signedVault("redeem", input.sliceId, lab);
      assertCurrentIdentity();
      const result = await request("/vault/redeem", redemptionSchema, body);
      assertCurrentIdentity();
      if (result.slice_id !== input.sliceId) throw new ApiError("Redemption references a different slice.");
      grants.set(input.sliceId, { token: result.download_token, expiresAt: result.expires_at });
      if (before.balance !== result.staker_balance)
        entries.push({ id: `purchase_${++sequence}`, kind: "purchase", amount: result.staker_balance - before.balance, sliceId: input.sliceId });
      const delivery = await transport.access(input.sliceId, result.download_token);
      assertCurrentIdentity();
      if (delivery.kind === "payment_required") throw new PaymentRequiredError(delivery);
      return { delivery, wallet: { balance: result.staker_balance, entries: [...entries] } };
    },
    reset: async () => {
      // A live workspace reset clears browser-held state only; server records remain intact.
      identityGeneration++;
      catalog = []; attestations.clear(); proposals.clear(); approvals.clear(); grants.clear(); ownerCredentials.clear(); entries = [];
    },
  };
}
export const api: ExchangeApi = resolveMode(import.meta.env) === "mock" ? createMockApi()
  : createLiveApi(import.meta.env.VITE_API_BASE_URL, import.meta.env.VITE_LAB_ID || "lab_synthesis");
