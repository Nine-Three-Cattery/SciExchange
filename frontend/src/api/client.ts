import { z } from "zod";
import {
  attestationSchema,
  proposalSchema,
  settlementSchema,
  sliceSchema,
  verificationSchema,
  vaultSchema,
  vaultRequestSchema,
  type ExchangeApi,
} from "./contracts";
import { createMockApi } from "../mocks/fixtures";
import { ApiError, messages } from "./errors";
import { createLiveAccess } from "./access";
export { ApiError } from "./errors";
export function resolveMode(
  env: Record<string, string | boolean | undefined>,
): "mock" | "live" {
  if (env.VITE_DATA_MODE !== undefined) {
    if (env.VITE_DATA_MODE !== "mock" && env.VITE_DATA_MODE !== "live")
      throw new Error("VITE_DATA_MODE must be mock or live.");
    return env.VITE_DATA_MODE;
  }
  if (
    env.VITE_USE_MOCK !== undefined &&
    env.VITE_USE_MOCK !== "true" &&
    env.VITE_USE_MOCK !== "false"
  )
    throw new Error("VITE_USE_MOCK must be true or false.");
  return env.VITE_USE_MOCK === "false" ? "live" : "mock";
}
export function createLiveApi(
  base = "http://localhost:8000/api/v1",
): ExchangeApi {
  async function request<T>(
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers:
          body === undefined
            ? undefined
            : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new ApiError(
          messages[response.status] ||
            `Request failed (HTTP ${response.status}).`,
          response.status,
        );
      let envelope: unknown;
      try {
        envelope = await response.json();
      } catch {
        throw new ApiError("Malformed response: expected JSON.");
      }
      const wrapped = z
        .object({ code: z.number(), data: z.unknown() })
        .safeParse(envelope);
      if (!wrapped.success)
        throw new ApiError("Malformed API response envelope.");
      if (wrapped.data.code !== 200)
        throw new ApiError(
          messages[wrapped.data.code] ||
            `Backend rejected the operation (${wrapped.data.code}).`,
          wrapped.data.code,
        );
      const parsed = schema.safeParse(wrapped.data.data);
      if (!parsed.success)
        throw new ApiError(
          "Backend response does not match the documented frontend contract.",
        );
      return parsed.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted)
        throw new ApiError(
          "Request timed out. Check the backend connection and retry.",
        );
      throw new ApiError(
        "Cannot reach the backend. Check the service URL, network and CORS settings.",
      );
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    mode: "live",
    ...createLiveAccess(base),
    wallet: async () => undefined,
    catalog: () =>
      request(
        "/slices",
        z
          .array(sliceSchema)
          .refine(
            (list) => new Set(list.map((s) => s.slice_id)).size === list.length,
          ),
      ),
    verify: (input) => request("/compiler/verify", verificationSchema, input),
    attestation: (id) =>
      request(
        `/slices/${encodeURIComponent(id)}/attestation`,
        attestationSchema,
      ),
    propose: (input) => request("/barter/propose", proposalSchema, input),
    sign: (id, role, signature) => {
      if (!signature || signature.signer_role !== role)
        return Promise.reject(
          new ApiError(
            "A secure external signing provider is required. No signature has been submitted.",
          ),
        );
      return request(
        `/barter/${encodeURIComponent(id)}/dual-sign`,
        settlementSchema,
        signature,
      );
    },
    analytics: () =>
      Promise.reject(
        new ApiError(
          "Live analysis is unavailable: Member B must confirm the analysis response schema. No simulated results are shown in live mode.",
        ),
      ),
    stake: (input) =>
      request(
        "/vault/stake-failure-data",
        vaultSchema,
        vaultRequestSchema.parse(input),
      ),
    reset: async () => {
      await request("/demo/reset", z.unknown(), {});
    },
  };
}
export const api: ExchangeApi =
  resolveMode(import.meta.env) === "mock"
    ? createMockApi()
    : createLiveApi(import.meta.env.VITE_API_BASE_URL);
