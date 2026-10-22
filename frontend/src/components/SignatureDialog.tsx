import { useEffect, useRef, useState } from "react";
import { Copy, ShieldCheck } from "lucide-react";
import { registerSignaturePrompt, type SignaturePrompt } from "../api/signing";
import { useI18n } from "../i18n/LanguageProvider";
import { ErrorNotice } from "./ui";

export function SignatureDialog() {
  const [request, setRequest] = useState<SignaturePrompt>();
  const pending = useRef<SignaturePrompt>();
  useEffect(() => {
    const unregister = registerSignaturePrompt((next) => {
      if (pending.current) {
        next.reject(new Error("Another signature review is already open."));
        return;
      }
      pending.current = next;
      setRequest(next);
    });
    return () => {
      unregister();
      pending.current?.reject(new Error("Signature review closed."));
      pending.current = undefined;
    };
  }, []);
  function finish(signature?: string) {
    const active = pending.current;
    pending.current = undefined;
    setRequest(undefined);
    if (signature) active?.resolve(signature);
    else
      active?.reject(
        new Error(
          "Signature review cancelled. No authorization was submitted.",
        ),
      );
  }
  return request ? <Review request={request} onFinish={finish} /> : null;
}

function Review({
  request,
  onFinish,
}: {
  request: SignaturePrompt;
  onFinish: (signature?: string) => void;
}) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [signature, setSignature] = useState("");
  const [copyNotice, setCopyNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      before?.focus();
    };
  }, []);
  function submit() {
    const value = signature.trim().replace(/^0x/i, "");
    if (!/^[0-9a-f]{128}$/i.test(value)) {
      setError(
        "Enter a 64-byte Ed25519 signature as 128 hexadecimal characters.",
      );
      return;
    }
    onFinish(value);
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(request.message);
      setCopyNotice("Canonical message copied.");
    } catch {
      setCopyNotice("Select and copy the canonical message below.");
    }
  }
  return (
    <dialog
      ref={dialog}
      className="approval-dialog"
      aria-labelledby="signature-title"
      onCancel={(event) => {
        event.preventDefault();
        onFinish();
      }}
    >
      <p className="eyebrow">
        <ShieldCheck size={17} /> {t("Human PI authorization")}
      </p>
      <h2 id="signature-title">{t("Sign authorization")}</h2>
      <p className="section-description">{t(request.purpose)}</p>
      <label className="field-label">
        {t("Signer lab")}
        <input aria-label={t("Signer lab")} readOnly value={request.address} />
      </label>
      <label className="field-label">
        {t("Canonical message")}
        <textarea
          aria-label={t("Canonical message")}
          readOnly
          rows={8}
          value={request.message}
        />
      </label>
      <button className="button" onClick={() => void copy()}>
        <Copy size={14} /> {t("Copy canonical message")}
      </button>
      {copyNotice && (
        <p className="small muted" role="status">
          {t(copyNotice)}
        </p>
      )}
      <p className="notice">
        {t(
          "Sign these exact UTF-8 bytes with the registered PI key on your own machine. Paste only the hexadecimal signature; never paste a private key.",
        )}
      </p>
      <p className="small muted">
        {t(
          "Local helper: save the message to a file, then run frontend/scripts/sign_message.py with your lab identity.",
        )}
      </p>
      <label className="field-label">
        {t("Signature (hex)")}
        <textarea
          aria-label={t("Signature (hex)")}
          autoComplete="off"
          spellCheck={false}
          rows={3}
          value={signature}
          onChange={(event) => {
            setSignature(event.target.value);
            setError("");
          }}
        />
      </label>
      {error && <ErrorNotice error={error} />}
      <footer className="modal-footer">
        <button className="button" onClick={() => onFinish()}>
          {t("Cancel signing")}
        </button>
        <button className="button primary" onClick={submit}>
          {t("Submit signature")}
        </button>
      </footer>
    </dialog>
  );
}
