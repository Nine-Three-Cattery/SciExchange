import { hasControl } from "../utils/text";
import { z } from "zod";
const boundedNumber = z
  .number()
  .finite()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const identifier = z
  .string()
  .min(1)
  .max(512)
  .refine((v) => !hasControl(v));
export const domainSchema = z.enum(["electrocatalysis", "battery_cycling"]);
export const sliceSchema = z.object({
  slice_id: identifier,
  domain: domainSchema,
  title: z.string(),
  data_classification: z.string(),
  is_attested: z.boolean(),
  attestation_uid: z.string().nullish(),
  price_scicredit: boundedNumber,
  summary: z.string(),
});
export type Slice = z.infer<typeof sliceSchema>;
export const submissionSchema = z
  .object({
    slice_id: z.string().min(1),
    domain: domainSchema,
    metadata: z.record(z.unknown()),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(z.number().finite())).min(1),
  })
  .refine(
    (v) => v.rows.every((row) => row.length === v.columns.length),
    "Each row must match the column count.",
  );
export type Submission = z.infer<typeof submissionSchema>;
export const verificationSchema = z
  .object({
    valid: z.boolean(),
    slice_id: identifier,
    violated_axioms: z.array(
      z.object({
        axiom_id: z.string(),
        name: z.string(),
        formula: z.string(),
        observed_value: z.number(),
        allowed_range: z.tuple([z.number(), z.number()]),
        severity: z.string(),
      }),
    ),
    safety_alerts: z.array(
      z.object({
        type: z.string(),
        pattern_matched: z.string(),
        action: z.string(),
      }),
    ),
    diagnostic_log: z.string(),
    attestation_uid: z.string().optional(),
  })
  .refine(
    (v) =>
      !v.valid ||
      (v.violated_axioms.length === 0 && v.safety_alerts.length === 0),
    "Contradictory verification response.",
  );
export type Verification = z.infer<typeof verificationSchema>;
// AttestationReport shape from docs/BACKEND_ARCHITECTURE.md; the endpoint owner must confirm it.
export const attestationSchema = z.object({
  attestation_uid: identifier,
  slice_id: identifier,
  compiler_status: z.string(),
  proof_of_priority: z.record(z.unknown()),
  instrument_fingerprint: z.record(z.unknown()),
  physics_results: z.record(z.unknown()),
  safety_clearance: z.record(z.unknown()),
  diagnostic_logs: z.array(z.string()),
  merkle_root: identifier,
});
export type Attestation = z.infer<typeof attestationSchema>;
export const proposalSchema = z.object({
  proposal_id: identifier,
  status: z.string(),
});
export type Proposal = z.infer<typeof proposalSchema>;
export interface ProposalRequest {
  proposer_agent_id: string;
  offered_slice_id: string;
  target_agent_id: string;
  requested_slice_id: string;
  proof_of_priority_hash: string;
}
export type Role = "pi_proposer" | "pi_target";
export interface SignatureRequest {
  signer_role: Role;
  signer_address: string;
  signature: string;
}
export const settlementSchema = z.object({ status: z.string() });
export interface Agreement {
  proposal: Proposal;
  offered: Slice;
  requested: Slice;
  approvals: Role[];
  settlementConfirmed: boolean;
}
// Frontend-only normalized chart model. No frozen live analysis response schema exists yet.
export interface Series {
  name: string;
  color: string;
  points: { x: number; y: number }[];
}
export interface Plot {
  title: string;
  xLabel: string;
  yLabel: string;
  series: Series[];
}
export interface Analytics {
  source: string;
  conditions: string;
  metrics: { label: string; value: string }[];
  plots: Plot[];
  warning: string;
}
export const vaultSchema = z.object({
  minted_scicredit: boundedNumber,
  vault_pool_total_slices: boundedNumber.int(),
  staker_balance: boundedNumber,
});
export type VaultResult = z.infer<typeof vaultSchema>;
export interface VaultRequest {
  slice_id: string;
  row_count: number;
  data_quality_score: number;
  staker_address: string;
}
// Frontend presentation interfaces; these are not invented backend endpoints.
export interface PaymentChallenge {
  kind: "payment_required";
  sliceId: string;
  amount: number;
  token: "SciCredit";
  payee: string;
  network: string;
  nonce: string;
  acceptedMethods: string[];
}
export interface DataDelivery {
  kind: "delivered";
  sliceId: string;
  format: "csv" | "json";
  text: string;
  rowCount: number;
  columnCount: number;
  filename: string;
  mediaType: string;
}
export interface CreditEntry {
  id: string;
  kind: "opening" | "stake" | "purchase";
  amount: number;
  sliceId?: string;
}
export interface WalletSnapshot {
  balance: number;
  entries: CreditEntry[];
}
export interface PurchaseInput {
  sliceId: string;
  nonce: string;
  receipt?: string;
}
export interface PurchaseResult {
  delivery: DataDelivery;
  wallet?: WalletSnapshot;
}
export const vaultRequestSchema = z.object({
  slice_id: identifier,
  row_count: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  data_quality_score: z.number().finite().min(0).max(1),
  staker_address: z.string().trim().min(1).max(512),
});
export function isEligible(slice: Slice, verification?: Verification) {
  return (
    slice.is_attested &&
    !!slice.attestation_uid &&
    verification?.valid !== false
  );
}
export interface ExchangeApi {
  mode: "mock" | "live";
  catalog(): Promise<Slice[]>;
  wallet(): Promise<WalletSnapshot | undefined>;
  access(sliceId: string): Promise<PaymentChallenge | DataDelivery>;
  purchase(input: PurchaseInput): Promise<PurchaseResult>;
  verify(input: Submission): Promise<Verification>;
  attestation(id: string): Promise<Attestation>;
  propose(input: ProposalRequest): Promise<Proposal>;
  sign(
    id: string,
    role: Role,
    signature?: SignatureRequest,
  ): Promise<z.infer<typeof settlementSchema>>;
  analytics(domain: Slice["domain"]): Promise<Analytics>;
  stake(input: VaultRequest): Promise<VaultResult>;
  reset(): Promise<void>;
}
export function applySignature(
  agreement: Agreement,
  role: Role,
  status: string,
): Agreement {
  const approvals =
    status === "PENDING_SECOND_PI_SIGNATURE" || status === "SWAP_COMPLETED"
      ? Array.from(new Set([...agreement.approvals, role]))
      : agreement.approvals;
  return {
    ...agreement,
    proposal: { ...agreement.proposal, status },
    approvals,
    settlementConfirmed: status === "SWAP_COMPLETED",
  };
}
