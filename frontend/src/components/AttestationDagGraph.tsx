import { useI18n } from "../i18n/LanguageProvider";
import { useState } from "react";
import {
  ArrowRight,
  Database,
  Fingerprint,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import type { Attestation, Slice, Verification } from "../api/contracts";
import { isRejected } from "../api/contracts";
import { Badge, Empty, ErrorNotice, Loading, Panel } from "./ui";
interface Props {
  slices: Slice[];
  selected: string;
  onSelect: (id: string) => void;
  record?: Attestation;
  verification?: Verification;
  loading: boolean;
  error: string;
  onRetry: () => void;
  mock: boolean;
  proposalId?: string;
}
export function AttestationDagGraph({
  slices,
  selected,
  onSelect,
  record,
  verification,
  loading,
  error,
  onRetry,
  mock,
  proposalId,
}: Props) {
  const { t } = useI18n();

  const [node, setNode] = useState(2);
  const nodes = record
    ? [
        {
          title: "Source laboratory",
          value: record.proof_of_priority,
          icon: FlaskConical,
        },
        {
          title: "Scientific slice",
          value: {
            slice_id: record.slice_id,
            instrument: record.instrument_fingerprint,
          },
          icon: Database,
        },
        {
          title: record.compiler_status === "FORMAL_PROOF_VALID" ? "Formal verification" : "Scientific checks",
          value: {
            compiler_status: record.compiler_status,
            physics_results: record.physics_results,
            safety_clearance: record.safety_clearance,
          },
          icon: ShieldCheck,
        },
        {
          title: "Priority attestation",
          value: {
            uid: record.attestation_uid,
            merkle_root: record.merkle_root,
            priority: record.proof_of_priority,
          },
          icon: Fingerprint,
        },
      ]
    : [];
  return (
    <Panel
      title={t("Attestation lineage")}
      eyebrow={t("02 / Provenance")}
      action={<Badge>{t(mock ? "Demo records" : "Server records")}</Badge>}
    >
      <p className="section-description">
        {t(
          "Trace the evidence behind a scientific slice. Select a node to inspect its record.",
        )}
      </p>
      <label className="field-label" htmlFor="provenance-slice">
        {t("Inspect slice")}
      </label>
      <select
        id="provenance-slice"
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
      >
        {slices.map((s) => (
          <option key={s.slice_id} value={s.slice_id}>
            {t(s.title)}
          </option>
        ))}
      </select>
      {loading ? (
        <Loading text={t("Loading attestation…")} />
      ) : error ? (
        <ErrorNotice error={error} retry={onRetry} />
      ) : record ? (
        <>
          <div
            className="dag"
            role="group"
            aria-label={t("Provenance dependency graph")}
          >
            {nodes.map((n, i) => (
              <div className="dag-step" key={n.title}>
                <button
                  className={`dag-node ${node === i ? "selected" : ""}`}
                  onClick={() => setNode(i)}
                  aria-pressed={node === i}
                >
                  <n.icon size={20} />
                  <small>
                    {t("0")}
                    {i + 1}
                  </small>
                  <strong>{t(n.title)}</strong>
                </button>
                {i < nodes.length - 1 && (
                  <ArrowRight className="dag-arrow" size={20} />
                )}
              </div>
            ))}
          </div>
          <div className="node-detail">
            <div className="row-between">
              <strong>{t(nodes[node].title)}</strong>
              <Badge
                tone={
                  record.compiler_status === "FORMAL_PROOF_VALID"
                    ? "success"
                    : "warning"
                }
              >
                {t(
                  record.compiler_status === "FORMAL_PROOF_VALID"
                    ? "Attested"
                    : "Review status",
                )}
              </Badge>
            </div>
            <pre>{JSON.stringify(nodes[node].value, null, 2)}</pre>
          </div>
          {proposalId && (
            <div className="notice">
              <ArrowRight size={16} />
              <span>
                {t("These slice records are referenced by agreement")}{" "}
                <code>{proposalId}</code>.
              </span>
            </div>
          )}
        </>
      ) : (
        <Empty>
          {t(
            isRejected(verification)
              ? "Slice rejected. No attestation or provenance chain was created."
              : "Select an attested slice to inspect available provenance.",
          )}
        </Empty>
      )}
    </Panel>
  );
}
