import { z } from "zod";
export const domainSchema = z.enum(["electrocatalysis", "battery_cycling"]);
export const sliceSchema = z.object({
  slice_id: z.string(),
  domain: domainSchema,
  title: z.string(),
  data_classification: z.string(),
  is_attested: z.boolean(),
  attestation_uid: z.string().nullish(),
  price_scicredit: z.number().nonnegative(),
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
export const verificationSchema = z.object({
  valid: z.boolean(),
  slice_id: z.string(),
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
});
export type Verification = z.infer<typeof verificationSchema>;
// AttestationReport shape from docs/BACKEND_ARCHITECTURE.md; the endpoint owner must confirm it.
export const attestationSchema = z.object({
  attestation_uid: z.string(),
  slice_id: z.string(),
  compiler_status: z.string(),
  proof_of_priority: z.record(z.unknown()),
  instrument_fingerprint: z.record(z.unknown()),
  physics_results: z.record(z.unknown()),
  safety_clearance: z.record(z.unknown()),
  diagnostic_logs: z.array(z.string()),
  merkle_root: z.string(),
});
export type Attestation = z.infer<typeof attestationSchema>;
export const proposalSchema = z.object({
  proposal_id: z.string(),
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
  minted_scicredit: z.number(),
  vault_pool_total_slices: z.number(),
  staker_balance: z.number(),
});
export type VaultResult = z.infer<typeof vaultSchema>;
export interface VaultRequest {
  slice_id: string;
  row_count: number;
  data_quality_score: number;
  staker_address: string;
}
export interface ExchangeApi {
  mode: "mock" | "live";
  catalog(): Promise<Slice[]>;
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
