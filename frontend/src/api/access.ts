import { hasControl } from "../utils/text";
import { z } from "zod";
import { ApiError, messages } from "./errors";
import type {
  DataDelivery,
  PaymentChallenge,
  PurchaseInput,
} from "./contracts";
const MAX_BYTES = 10 * 1024 * 1024;
const amountSchema = z
  .number()
  .finite()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
const challengeBody = z.object({
  code: z.literal(402),
  data: z.object({
    slice_id: z.string().min(1),
    accepted_methods: z.array(z.string()).min(1),
    challenge_nonce: z
      .string()
      .min(1)
      .max(2048)
      .refine((v) => !!v.trim() && !hasControl(v)),
  }),
});
export class PaymentRequiredError extends ApiError {
  constructor(public challenge: PaymentChallenge) {
    super(
      "Payment is not confirmed. Review the current access challenge before retrying.",
      402,
    );
  }
}
export function validateReceipt(receipt: string): string {
  const value = receipt.trim();
  if (!value || value.length > 8192 || hasControl(value))
    throw new ApiError("Enter a valid external payment receipt.");
  return value;
}
async function readLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get("Content-Length"));
  if (declared > MAX_BYTES)
    throw new ApiError("Delivery exceeds the 10 MB preview limit.");
  if (!response.body)
    throw new ApiError("The backend returned an empty delivery.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = "";
  try {
    for (;;) {
      const item = await reader.read();
      if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > MAX_BYTES) {
        await reader.cancel();
        throw new ApiError("Delivery exceeds the 10 MB preview limit.");
      }
      body += decoder.decode(item.value, { stream: true });
    }
    return body + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
// Parse quoted fields without evaluating data. Only numeric tensor rows are accepted.
export function parseScientificCsv(text: string): {
  columns: string[];
  rows: number[][];
} {
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closed = false;
  const pushField = () => {
    row.push(field);
    field = "";
    closed = false;
  };
  const pushRow = () => {
    pushField();
    records.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += char;
      continue;
    }
    if (char === '"') {
      if (field || closed) throw new ApiError("Malformed scientific CSV.");
      quoted = true;
    } else if (char === ",") pushField();
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      pushRow();
    } else {
      if (closed) throw new ApiError("Malformed scientific CSV.");
      field += char;
    }
  }
  if (quoted) throw new ApiError("Malformed scientific CSV.");
  if (field || row.length || closed) pushRow();
  const [columns, ...raw] = records;
  if (
    !columns?.length ||
    !raw.length ||
    new Set(columns).size !== columns.length ||
    columns.some((c) => !c.trim() || /^[\s]*[=+\-@]/.test(c) || hasControl(c))
  )
    throw new ApiError("Malformed scientific CSV.");
  const rows = raw.map((r) => {
    if (
      r.length !== columns.length ||
      r.some(
        (v) =>
          !/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim()) ||
          !Number.isFinite(Number(v)),
      )
    )
      throw new ApiError("Malformed scientific CSV.");
    return r.map(Number);
  });
  return { columns, rows };
}
export function createDelivery(
  sliceId: string,
  format: "csv" | "json",
  text: string,
): DataDelivery {
  let rowCount: number;
  let columnCount: number;
  if (format === "csv") {
    const parsed = parseScientificCsv(text);
    rowCount = parsed.rows.length;
    columnCount = parsed.columns.length;
  } else {
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError("Malformed tensor JSON.");
    }
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "code" in body
    ) {
      const envelope = z
        .object({ code: z.literal(200), data: z.unknown() })
        .safeParse(body);
      if (!envelope.success)
        throw new ApiError(
          "The backend did not confirm a successful data delivery.",
        );
      body = envelope.data.data;
    }
    const matrix = z
      .array(z.array(z.number().finite()).min(1))
      .min(1)
      .safeParse(body);
    if (
      !matrix.success ||
      !matrix.data.every((r) => r.length === matrix.data[0].length)
    )
      throw new ApiError("Malformed tensor JSON.");
    rowCount = matrix.data.length;
    columnCount = matrix.data[0].length;
    text = JSON.stringify(matrix.data, null, 2);
  }
  const safeId =
    sliceId.replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120) || "slice";
  return {
    kind: "delivered",
    sliceId,
    format,
    text,
    rowCount,
    columnCount,
    filename: `sciexchange_${safeId}.${format}`,
    mediaType: format === "csv" ? "text/csv" : "application/json",
  };
}
export function createLiveAccess(base: string) {
  async function access(
    sliceId: string,
    receipt?: string,
  ): Promise<PaymentChallenge | DataDelivery> {
    const proof = receipt === undefined ? undefined : validateReceipt(receipt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(
        `${base.replace(/\/$/, "")}/slices/${encodeURIComponent(sliceId)}/download`,
        {
          method: "GET",
          headers: proof ? { "X-Payment-Receipt": proof } : undefined,
          signal: controller.signal,
          redirect: "error",
          credentials: "omit",
          cache: "no-store",
          referrerPolicy: "no-referrer",
        },
      );
      if (response.status !== 402 && response.status !== 200)
        throw new ApiError(
          messages[response.status] ||
            `Request failed (HTTP ${response.status}).`,
          response.status,
        );
      const body = await readLimited(response);
      if (response.status === 402) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(body);
        } catch {
          throw new ApiError("Malformed payment challenge.", 402);
        }
        const payload = challengeBody.safeParse(parsed);
        const rawAmount = response.headers.get("X-Payment-Amount");
        const amount =
          rawAmount?.trim() && /^\d+(?:\.\d+)?$/.test(rawAmount.trim())
            ? Number(rawAmount)
            : NaN;
        const token = response.headers.get("X-Payment-Token");
        const payee = response.headers.get("X-Payment-Address")?.trim();
        const network = response.headers.get("X-Settlement-Network")?.trim();
        if (
          !payload.success ||
          payload.data.data.slice_id !== sliceId ||
          !amountSchema.safeParse(amount).success ||
          token !== "SciCredit" ||
          !payee ||
          !network ||
          response.headers.get("X-Payment-Required") !== "true"
        )
          throw new ApiError(
            "Malformed payment challenge. Required x402 headers may not be exposed by CORS.",
            402,
          );
        return {
          kind: "payment_required",
          sliceId,
          amount,
          token,
          payee,
          network,
          nonce: payload.data.data.challenge_nonce,
          acceptedMethods: payload.data.data.accepted_methods,
        };
      }
      const type = response.headers
        .get("Content-Type")
        ?.split(";")[0]
        .trim()
        .toLowerCase();
      if (type === "text/csv" || type === "application/csv")
        return createDelivery(sliceId, "csv", body);
      if (type === "application/json")
        return createDelivery(sliceId, "json", body);
      throw new ApiError(
        "Unsupported delivery format. Expected scientific CSV or tensor JSON.",
      );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        controller.signal.aborted
          ? "Request timed out. Payment or data delivery is not confirmed. Do not pay again before checking the external payment status."
          : "Cannot confirm data delivery. Check the connection; do not make a second payment without checking the first.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    access,
    purchase: async (input: PurchaseInput) => {
      if (!input.receipt || !input.nonce)
        throw new ApiError(
          "Live credit transfers require an external payment provider. No transfer endpoint is defined.",
        );
      const result = await access(input.sliceId, input.receipt);
      if (result.kind === "payment_required")
        throw new PaymentRequiredError(result);
      return { delivery: result };
    },
  };
}
