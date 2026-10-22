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
export const domainSchema = z.enum(["electrocatalysis", "battery_cycling", "hydrothermal_synthesis"]);
export const sliceSchema = z.object({
  slice_id: identifier,
  domain: domainSchema,
  title: z.string(),
  data_classification: z.string(),
  is_attested: z.boolean(),
  attestation_uid: z.string().nullish(),
  price_scicredit: boundedNumber,
  summary: z.string(),
  owner_lab_id: identifier.optional(),
  quarantined: z.boolean().optional(),
  accepts_barter: z.boolean().optional(),
  provenance: z.record(z.unknown()).optional(),
  verification_kind: z.string().optional(),
});
export type Slice = z.infer<typeof sliceSchema>;
export const sampleCellSchema = z.union([z.number().finite(), z.string()]);
export const sampleTableSchema = z.object({
  columns: z.array(z.string()).min(1),
  rows: z.array(z.array(sampleCellSchema)).min(1),
}).refine((table) => new Set(table.columns).size === table.columns.length &&
  table.rows.every((row) => row.length === table.columns.length),
  "Samples must have unique columns and matching row widths.");
export const submissionSchema = z
  .object({
    slice_id: z.string().min(1),
    domain: domainSchema,
    metadata: z.record(z.unknown()),
    columns: z.array(z.string()).min(1),
    rows: z.array(z.array(sampleCellSchema)).min(1),
    charge_curve: sampleTableSchema.optional(),
  })
  .refine(
    (v) => v.rows.every((row) => row.length === v.columns.length),
    "Each row must match the column count.",
  );
export type Submission = z.infer<typeof submissionSchema>;
export type CompilerInput = Submission | { slice_id: string };
export type ScientificDocument = Submission;
export const verificationSchema = z
  .object({
    valid: z.boolean(),
    slice_id: identifier,
    violated_axioms: z.array(
      z.object({
        axiom_id: z.string(),
        name: z.string(),
        formula: z.string(),
        observed_value: z.unknown(),
        allowed_range: z.unknown(),
        severity: z.string(),
      }),
    ),
    safety_alerts: z.array(
      z.object({
        type: z.string(),
        pattern_matched: z.string().optional(),
        rule: z.string().optional(),
        path: z.string().optional(),
        action: z.string(),
      }),
    ),
    diagnostic_log: z.string(),
    attestation_uid: z.string().nullish(),
  }).passthrough()
  .refine(
    (v) =>
      !v.valid ||
      (v.violated_axioms.length === 0 && v.safety_alerts.length === 0),
    "Contradictory verification response.",
  );
export type Verification = z.infer<typeof verificationSchema>;
// Public attestation returned by the current gateway.
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
  verification_scope: z.string().optional(),
});
export type Attestation = z.infer<typeof attestationSchema>;
export const proposalSchema = z.object({
  proposal_id: identifier,
  status: z.string(),
  party_a_lab: identifier.optional(),
  party_a_slice_id: identifier.optional(),
  party_b_lab: identifier.optional(),
  party_b_slice_id: identifier.optional(),
  canonical_agreement: z.string().optional(),
  expires_at: z.string().optional(),
});
export type Proposal = z.infer<typeof proposalSchema>;
export interface ProposalRequest {
  proposer_agent_id: string;
  offered_slice_id: string;
  target_agent_id: string;
  requested_slice_id: string;
  proof_of_priority_hash: string;
  party_a_lab?: string;
  party_b_lab?: string;
}
export type Role = "pi_proposer" | "pi_target";
export interface SignatureRequest {
  signer_role: Role;
  signer_address: string;
  signature: string;
}
export const settlementSchema = proposalSchema.partial().extend({
  status: z.string(),
  proposer_signed: z.boolean().optional(),
  target_signed: z.boolean().optional(),
  expired: z.boolean().optional(),
  download_token: z.string().optional(),
  downloaded_slice_id: z.string().optional(),
});
export type Settlement = z.infer<typeof settlementSchema>;
export interface Agreement {
  proposal: Proposal;
  offered: Slice;
  requested: Slice;
  approvals: Role[];
  settlementConfirmed: boolean;
}
// Presentation models mapped from authorized gateway samples and numerical results.
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
  row_count?: number;
  data_quality_score?: number;
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
  document?: ScientificDocument;
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
    !slice.quarantined &&
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
  verify(input: CompilerInput): Promise<Verification>;
  getLab?(): string;
  setLab?(address: string): void;
  poll?(id: string): Promise<Settlement>;
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
  server?: Settlement,
): Agreement {
  const completed = ["SWAP_COMPLETED", "DUAL_SIGNED_AND_EXECUTED"].includes(status) && !server?.expired;
  let approvals =
    status === "PENDING_SECOND_PI_SIGNATURE" || completed
      ? Array.from(new Set([...agreement.approvals, role]))
      : agreement.approvals;
  if (server?.proposer_signed !== undefined || server?.target_signed !== undefined) {
    approvals = [];
    if (server.proposer_signed) approvals.push("pi_proposer");
    if (server.target_signed) approvals.push("pi_target");
  }
  return {
    ...agreement,
    proposal: { ...agreement.proposal, status },
    approvals,
    settlementConfirmed: completed,
  };
}
