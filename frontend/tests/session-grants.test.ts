import { waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLiveApi } from "../src/api/client";
import { registerSignaturePrompt } from "../src/api/signing";

const document = { slice_id: "battery_real", version: "v1", domain: "battery_cycling", metadata: {},
  columns: ["cycle_index", "discharge_capacity_ah"], rows: [[1, 1]] };
const summary = { slice_id: document.slice_id, version: "v1", domain: document.domain,
  title: "Battery", summary: "Experimental slice", data_classification: "experimental_reference",
  owner_lab_id: "lab_a", is_attested: true, attestation_uid: "attest_real", price_scicredit: 50,
  review_status: "approved", compiler_status: "REVIEW_REQUIRED" };
const approval = { signer_role: "pi_proposer" as const, signer_address: "lab_a", signature: "test_pi_approval" };
const pendingStatus = { proposal_id: "p1", status: "PENDING_SECOND_PI_SIGNATURE" };
const completeStatus = { proposal_id: "p1", status: "DUAL_SIGNED_AND_EXECUTED", expired: false };
const scopedGrant = { ...completeStatus, download_token: "old_session_grant", downloaded_slice_id: document.slice_id };
const ok = (data: unknown) => Response.json({ code: 200, data });
const headersOf = (options?: RequestInit) => options?.headers as Record<string, string> | undefined;
let unregister: (() => void) | undefined;
afterEach(() => { unregister?.(); unregister = undefined; });
function signImmediately() {
  unregister = registerSignaturePrompt(request => request.resolve("test_signature"));
}

describe("identity-scoped exchange grants", () => {
  it("does not replay the previous PI approval after changing labs", async () => {
    let complete = false;
    const signedRequests: string[] = [];
    let lastDownloadHeaders: Record<string, string> | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith("/dual-sign")) return ok(pendingStatus);
      if (url.includes("/proposals/")) {
        const signer = headersOf(options)?.["X-PI-Address"];
        if (signer) signedRequests.push(signer);
        return ok(!complete ? pendingStatus : signer ? scopedGrant : completeStatus);
      }
      if (url.includes("/download")) { lastDownloadHeaders = headersOf(options); return Response.json(document); }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_a");
    await api.sign("p1", "pi_proposer", approval);
    api.setLab!("lab_b");
    complete = true;
    await api.poll!("p1");
    await api.access(document.slice_id);
    expect(signedRequests).toEqual([]);
    expect(lastDownloadHeaders).toBeUndefined();
  });

  it("requires explicit restoration by the same active lab after an A-B-A switch", async () => {
    let complete = false;
    const signedRequests: string[] = [];
    let lastDownloadHeaders: Record<string, string> | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith("/dual-sign")) return ok(pendingStatus);
      if (url.includes("/proposals/")) {
        const signer = headersOf(options)?.["X-PI-Address"];
        if (signer) signedRequests.push(signer);
        return ok(!complete ? pendingStatus : signer ? scopedGrant : completeStatus);
      }
      if (url.includes("/download")) { lastDownloadHeaders = headersOf(options); return Response.json(document); }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_a");
    await api.sign("p1", "pi_proposer", approval);
    complete = true;
    api.setLab!("lab_b");
    await expect(api.poll!("p1", "lab_a")).rejects.toThrow("active laboratory only");
    api.setLab!("lab_a");
    await api.poll!("p1");
    await api.access(document.slice_id);
    expect(signedRequests).toEqual([]);
    expect(lastDownloadHeaders).toBeUndefined();
    await api.poll!("p1", "lab_a");
    await api.access(document.slice_id);
    expect(signedRequests).toEqual(["lab_a"]);
    expect(lastDownloadHeaders).toEqual({ "X-Payment-Receipt": "old_session_grant" });
  });

  it.each(["public_status", "signed_grant"])("discards a late poll at %s", async stage => {
    let complete = false;
    let release: ((response: Response) => void) | undefined;
    let lastDownloadHeaders: Record<string, string> | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith("/dual-sign")) return ok(pendingStatus);
      if (url.includes("/proposals/")) {
        if (!complete) return ok(pendingStatus);
        const signed = !!headersOf(options)?.["X-PI-Address"];
        if (signed || stage === "public_status") return new Promise<Response>(resolve => { release = resolve; });
        return ok(completeStatus);
      }
      if (url.includes("/download")) { lastDownloadHeaders = headersOf(options); return Response.json(document); }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_a");
    await api.sign("p1", "pi_proposer", approval);
    complete = true;
    const pending = api.poll!("p1");
    await waitFor(() => expect(release).toBeDefined());
    api.setLab!("lab_b");
    const rejected = expect(pending).rejects.toThrow("active laboratory changed");
    release!(ok(stage === "signed_grant" ? scopedGrant : completeStatus));
    await rejected;
    await api.access(document.slice_id);
    expect(lastDownloadHeaders).toBeUndefined();
  });

  it("does not retain a late dual-sign response in the new session", async () => {
    let release: ((response: Response) => void) | undefined;
    let lastDownloadHeaders: Record<string, string> | undefined;
    const signedRequests: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.endsWith("/dual-sign")) return new Promise<Response>(resolve => { release = resolve; });
      if (url.includes("/proposals/")) {
        const signer = headersOf(options)?.["X-PI-Address"];
        if (signer) signedRequests.push(signer);
        return ok(signer ? scopedGrant : completeStatus);
      }
      if (url.includes("/download")) { lastDownloadHeaders = headersOf(options); return Response.json(document); }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_a");
    const pending = api.sign("p1", "pi_proposer", approval);
    await waitFor(() => expect(release).toBeDefined());
    api.setLab!("lab_b");
    const rejected = expect(pending).rejects.toThrow("active laboratory changed");
    release!(ok(scopedGrant));
    await rejected;
    await api.poll!("p1");
    await api.access(document.slice_id);
    expect(signedRequests).toEqual([]);
    expect(lastDownloadHeaders).toBeUndefined();
  });
});

describe("identity-scoped downloads and wallet writes", () => {
  it.each(["owner_read", "external_receipt"])("does not return a late %s download", async action => {
    signImmediately();
    let armed = false;
    let release: ((response: Response) => void) | undefined;
    let lastDownloadHeaders: Record<string, string> | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/slices?")) return ok([summary]);
      if (url.includes("/download")) {
        lastDownloadHeaders = headersOf(options);
        if (armed) { armed = false; return new Promise<Response>(resolve => { release = resolve; }); }
        return Response.json(document);
      }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_a");
    await api.catalog();
    if (action === "owner_read") await api.access(document.slice_id);
    armed = true;
    const pending = action === "owner_read" ? api.access(document.slice_id)
      : api.purchase({ sliceId: document.slice_id, nonce: "test_nonce", receipt: "test_receipt" });
    await waitFor(() => expect(release).toBeDefined());
    api.setLab!("lab_b");
    const rejected = expect(pending).rejects.toThrow("active laboratory changed");
    release!(Response.json(document));
    await rejected;
    await api.access(document.slice_id);
    expect(lastDownloadHeaders).toBeUndefined();
  });

  it.each(["deposit", "redeem"])("does not cache a late %s receipt or ledger entry", async action => {
    signImmediately();
    let release: ((response: Response) => void) | undefined;
    let lastDownloadHeaders: Record<string, string> | undefined;
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url: string, options: RequestInit) => {
      if (url.includes("/balance")) return ok({ address: new URL(url).searchParams.get("address"), staker_balance: 100 });
      if (url.endsWith("/challenge")) return ok({ nonce: "test_nonce", canonical_message: "test_vault_message", expires_at: "2099-01-01T00:00:00Z" });
      if (url.endsWith(`/${action}`)) return new Promise<Response>(resolve => { release = resolve; });
      if (url.includes("/download")) { lastDownloadHeaders = headersOf(options); return Response.json(document); }
      throw new Error(url);
    }));
    const api = createLiveApi(undefined, "lab_a");
    const pending = action === "deposit"
      ? api.stake({ slice_id: document.slice_id, staker_address: "lab_a" })
      : api.purchase({ sliceId: document.slice_id, nonce: "test_nonce" });
    await waitFor(() => expect(release).toBeDefined());
    api.setLab!("lab_b");
    const rejected = expect(pending).rejects.toThrow("active laboratory changed");
    release!(ok(action === "deposit"
      ? { minted_scicredit: 10, vault_pool_total_slices: 1, staker_balance: 110 }
      : { slice_id: document.slice_id, download_token: "old_session_grant", expires_at: null, staker_balance: 50 }));
    await rejected;
    expect((await api.wallet())?.entries).toEqual([]);
    await api.access(document.slice_id);
    expect(lastDownloadHeaders).toBeUndefined();
  });
});
