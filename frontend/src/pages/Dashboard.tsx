import { getOwn } from "../utils/records";
import { useI18n, translate } from "../i18n/LanguageProvider";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Database,
  FileCheck2,
  Fingerprint,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  LockKeyhole,
  Menu,
  Network,
  Play,
  ShieldCheck,
  ShoppingCart,
  Terminal,
  X,
} from "lucide-react";
import { api as defaultApi } from "../api/client";
import {
  applySignature,
  type Agreement,
  type Attestation,
  type ExchangeApi,
  type Role,
  type Slice,
  type CompilerInput,
  type Verification,
  type VaultResult,
  type VaultRequest,
  type WalletSnapshot,
  type DataDelivery,
  type PurchaseInput,
  isEligible,
  isRejected,
  applyVerification,
} from "../api/contracts";
import { AttestationDagGraph } from "../components/AttestationDagGraph";
import { BarterNegotiationCard } from "../components/BarterNegotiationCard";
import { DataPurchaseModal } from "../components/DataPurchaseModal";
import { DataMarketplace } from "../components/DataMarketplace";
import { CreditWallet } from "../components/CreditWallet";
import { DataVault } from "../components/DataVault";
import { DualDomainAnalytics } from "../components/DualDomainAnalytics";
import { SignatureDialog } from "../components/SignatureDialog";
import { HeaderNavbar } from "../components/HeaderNavbar";
import { HumanDualSignModal } from "../components/HumanDualSignModal";
import { PhysicsCompilerConsole } from "../components/PhysicsCompilerConsole";
import {
  Badge,
  Empty,
  ErrorNotice,
  Loading,
  Panel,
  errorText,
} from "../components/ui";
type View =
  | "overview"
  | "compiler"
  | "provenance"
  | "exchange"
  | "marketplace"
  | "analytics"
  | "vault"
  | "project";
const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "marketplace", label: "Buy data", icon: ShoppingCart },
  { id: "compiler", label: "Physics compiler", icon: Terminal },
  { id: "provenance", label: "Provenance", icon: GitBranch },
  { id: "exchange", label: "Data exchange", icon: ArrowDownLeft },
  { id: "analytics", label: "Scientific analytics", icon: Activity },
  { id: "vault", label: "Data vault", icon: Database },
] as const;
const scenes: [View, string, string][] = [
  [
    "overview",
    "The scientific workspace",
    "Discover, verify and exchange scientific data.",
  ],
  [
    "compiler",
    "Trust starts with physics",
    "Inspect a fraudulent slice and its conservation diagnostics.",
  ],
  [
    "exchange",
    "Research without silos",
    "Propose a reciprocal exchange between two laboratories.",
  ],
  [
    "exchange",
    "Human control, by design",
    "Review the agreement and approve as both Human PIs.",
  ],
  [
    "analytics",
    "From data to insight",
    "Explore kinetics, capacity and differential capacity.",
  ],
  [
    "project",
    "Built for open science",
    "Review the architecture and reusable project deliverables.",
  ],
];
const pageCopy: Record<View, [string, string]> = {
  marketplace: [
    "Data marketplace",
    "Buy scientific data with SciCredit. Review the price, authorize payment and download your data.",
  ],
  overview: [
    "Research overview",
    "A clear view of your scientific data, trust and exchange activity.",
  ],
  compiler: [
    "Physics compiler",
    "Verify experimental slices against physical invariants and safety checks.",
  ],
  provenance: [
    "Scientific provenance",
    "Follow the record from laboratory source to priority attestation.",
  ],
  exchange: [
    "Data exchange",
    "Connect complementary research through an authorized, reciprocal exchange.",
  ],
  analytics: [
    "Scientific analytics",
    "Explore domain-specific signals with experimental context intact.",
  ],
  vault: [
    "Data liquidity vault",
    "Bring verified negative results back into the research cycle.",
  ],
  project: [
    "Open science, with evidence.",
    "A zero-trust scientific data workspace for the OSI Hackathon 2026.",
  ],
};
interface EventRecord {
  id: number;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "danger";
}
export function Dashboard({ api = defaultApi }: { api?: ExchangeApi }) {
  const { t } = useI18n();

  const [view, setView] = useState<View>("overview");
  const [sidebar, setSidebar] = useState(false);
  const [catalogSlices, setSlices] = useState<Slice[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [results, setResults] = useState<Record<string, Verification>>({});
  const [selected, setSelected] = useState("slice_catalysis_oer_nife_001");
  const [compilerSliceId, setCompilerSliceId] = useState<string>();
  const [record, setRecord] = useState<Attestation>();
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState("");
  const [agreement, setAgreement] = useState<Agreement>();
  const [vaultResults, setVaultResults] = useState<Record<string, VaultResult>>({});
  const [wallet, setWallet] = useState<WalletSnapshot>();
  const [activeLab, setActiveLab] = useState(api.getLab?.() || "lab_synthesis");
  const [exchangeError, setExchangeError] = useState("");
  const [purchaseSlice, setPurchaseSlice] = useState<Slice>();
  const [deliveries, setDeliveries] = useState<Record<string, DataDelivery>>(
    {},
  );
  const [operationBusy, setOperationBusy] = useState(false);
  const operationLock = useRef(false);
  const walletRequest = useRef(0);
  const slices = catalogSlices.map((slice) => applyVerification(slice, getOwn(results, slice.slice_id)));
  const [modal, setModal] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState("");
  const [scene, setScene] = useState<number>();
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [generation, setGeneration] = useState(0);
  const eventId = useRef(0);
  const operationGeneration = useRef(0);
  const attRequest = useRef(0);
  const catalogRequest = useRef(0);
  const addEvent = (
    title: string,
    detail: string,
    tone: EventRecord["tone"] = "neutral",
  ) =>
    setEvents((prev) =>
      [{ id: ++eventId.current, title, detail, tone }, ...prev].slice(0, 8),
    );
  const refreshWallet = useCallback(async () => {
    const request = ++walletRequest.current;
    try {
      const value = await api.wallet();
      if (request === walletRequest.current) setWallet(value);
    } catch (error) {
      if (request === walletRequest.current) setWallet(undefined);
      throw error;
    }
  }, [api]);
  async function withOperation<T>(work: () => Promise<T>): Promise<T> {
    if (operationLock.current)
      throw new Error(
        "Another workflow operation is in progress. Wait for it to finish.",
      );
    operationLock.current = true;
    setOperationBusy(true);
    try {
      return await work();
    } finally {
      operationLock.current = false;
      setOperationBusy(false);
    }
  }
  const verify = (input: CompilerInput) =>
    withOperation(() => verifyNow(input));
  const propose = (offered: Slice, requested: Slice) =>
    withOperation(() => proposeNow(offered, requested));
  const approve = (role: Role) => withOperation(() => approveNow(role));
  const stake = (input: VaultRequest) => withOperation(() => stakeNow(input));
  async function reset() {
    try {
      await withOperation(resetNow);
    } catch (error) {
      setResetError(errorText(error));
    }
  }
  function eligibleSlice(id: string) {
    const slice = slices.find((s) => s.slice_id === id);
    if (!slice || !isEligible(slice, getOwn(results, id)))
      throw new Error(
        "Only currently attested slices can be acquired or exchanged.",
      );
    return slice;
  }
  async function checkedAttestation(slice: Slice) {
    const proof = await api.attestation(slice.slice_id);
    if (
      proof.slice_id !== slice.slice_id ||
      !["FORMAL_PROOF_VALID", "CHECKS_PASSED", "REVIEW_REQUIRED"].includes(proof.compiler_status) ||
      !proof.merkle_root ||
      proof.attestation_uid !== slice.attestation_uid
    )
      throw new Error(
        "A matching, valid attestation is required for both slices.",
      );
    return proof;
  }
  function canReadOwn(slice: Slice) {
    return (
      api.mode === "live" &&
      !slice.quarantined &&
      slice.owner_lab_id === activeLab
    );
  }
  function accessLabel(slice: Slice) {
    return getOwn(deliveries, slice.slice_id)
      ? "View acquired data"
      : canReadOwn(slice)
        ? "Read own data"
        : "Buy data";
  }
  const access = (id: string, renewOwnerAuthorization = false) =>
    withOperation(async () => {
      const slice = slices.find((item) => item.slice_id === id);
      if (!slice) throw new Error("Scientific slice not found.");
      if (!canReadOwn(slice)) {
        eligibleSlice(id);
        await checkedAttestation(slice);
      }
      const response = await api.access(id, renewOwnerAuthorization);
      if (response.sliceId !== id)
        throw new Error("Data access response references a different slice.");
      if (response.kind === "delivered") {
        setDeliveries((prev) => ({ ...prev, [id]: response }));
        await refreshWallet().catch(() => {});
      }
      return response;
    });
  const purchase = (input: PurchaseInput) =>
    withOperation(async () => {
      eligibleSlice(input.sliceId);
      let response;
      try {
        response = await api.purchase(input);
      } catch (error) {
        // Redemption can commit before delivery fails. Reconcile its balance
        // without hiding the delivery error or asking for another payment.
        await refreshWallet().catch(() => {});
        throw error;
      }
      if (response.delivery.sliceId !== input.sliceId)
        throw new Error("Data access response references a different slice.");
      setDeliveries((prev) => ({
        ...prev,
        [input.sliceId]: response.delivery,
      }));
      if (response.wallet) {
        walletRequest.current++;
        setWallet(response.wallet);
      }
      addEvent("Data acquisition confirmed", input.sliceId, "success");
      return response;
    });
  const loadCatalog = useCallback(
    async (background = false) => {
      const request = ++catalogRequest.current;
      const gen = operationGeneration.current;
      if (!background) {
        setLoading(true);
        void refreshWallet().catch(() => {});
      }
      setCatalogError("");
      try {
        const data = await api.catalog();
        if (
          gen === operationGeneration.current &&
          request === catalogRequest.current
        ) {
          setSlices(data);
          setSelected((current) =>
            data.some((slice) => slice.slice_id === current)
              ? current
              : data[0]?.slice_id || "",
          );
        }
      } catch (e) {
        if (
          gen === operationGeneration.current &&
          request === catalogRequest.current
        )
          setCatalogError(errorText(e));
      } finally {
        if (
          gen === operationGeneration.current &&
          request === catalogRequest.current
        ) {
          if (!background) setLoading(false);
        }
      }
    },
    [api, refreshWallet],
  );
  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog, generation]);
  const loadAttestation = useCallback(
    async (id: string) => {
      const request = ++attRequest.current;
      setAttLoading(true);
      setRecord(undefined);
      setAttError("");
      try {
        if (isRejected(getOwn(results, id)))
          throw new Error(
            "Slice rejected. No attestation or provenance chain was created.",
          );
        const data = await api.attestation(id);
        if (request === attRequest.current) {
          if (data.slice_id !== id)
            throw new Error(
              "Attestation response references a different slice.",
            );
          setRecord(data);
        }
      } catch (e) {
        if (request === attRequest.current) setAttError(errorText(e));
      } finally {
        if (request === attRequest.current) setAttLoading(false);
      }
    },
    [api, results],
  );
  useEffect(() => {
    if (view === "provenance") void loadAttestation(selected);
  }, [view, selected, loadAttestation, generation]);
  useEffect(() => {
    const proposalId = agreement?.proposal.proposal_id;
    if (
      api.mode !== "live" ||
      !api.poll ||
      !proposalId ||
      agreement?.settlementConfirmed
    )
      return;
    let active = true;
    const refresh = async () => {
      if (operationLock.current) return;
      try {
        const response = await api.poll!(proposalId);
        if (!active) return;
        if (response.expired) {
          setAgreement(undefined);
          setExchangeError(
            "This agreement has expired. Propose a new exchange.",
          );
          return;
        }
        setAgreement((current) =>
          current?.proposal.proposal_id === proposalId
            ? applySignature(current, "pi_proposer", response.status, response)
            : current,
        );
        setExchangeError("");
      } catch (error) {
        if (active) setExchangeError(errorText(error));
      }
    };
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [api, agreement?.proposal.proposal_id, agreement?.settlementConfirmed]);

  function changeLab(address: string) {
    api.setLab?.(address);
    setActiveLab(address);
    setWallet(undefined);
    setVaultResults({});
    setDeliveries({});
    setPurchaseSlice(undefined);
    void refreshWallet().catch((error) => setExchangeError(errorText(error)));
  }

  function navigate(next: View) {
    setView(next);
    setSidebar(false);
  }
  function inspect(id: string) {
    setSelected(id);
    navigate("provenance");
  }
  async function verifyNow(input: CompilerInput) {
    const gen = operationGeneration.current;
    const result = await api.verify(input);
    if (gen !== operationGeneration.current) return;
    if (result.slice_id !== input.slice_id)
      throw new Error("Verification response references a different slice.");
    setResults((prev) => ({ ...prev, [result.slice_id]: result }));
    await loadCatalog(true);
    addEvent(
      isRejected(result) ? "Scientific slice rejected" : result.valid ? "Slice verification passed" : "Scientific review required",
      result.slice_id,
      isRejected(result) ? "danger" : result.valid ? "success" : "neutral",
    );
  }
  async function review(id: string) {
    await withOperation(async () => {
      if (!api.review) throw new Error("Scientific admission is unavailable.");
      const gen = operationGeneration.current;
      const result = await api.review(id);
      if (gen !== operationGeneration.current) return;
      if (result.slice_id !== id) throw new Error("Admission response references a different slice.");
      setResults(previous => ({ ...previous, [id]: result }));
      await loadCatalog(true);
      addEvent("Human admission approved", id, "success");
    });
  }
  async function proposeNow(offered: Slice, requested: Slice) {
    const gen = operationGeneration.current;
    eligibleSlice(offered.slice_id);
    eligibleSlice(requested.slice_id);
    const [proof] = await Promise.all([
      checkedAttestation(offered),
      checkedAttestation(requested),
    ]);
    const proposal = await api.propose({
      proposer_agent_id: "agent_catalysis_0x1a",
      offered_slice_id: offered.slice_id,
      target_agent_id: "agent_battery_0x2b",
      requested_slice_id: requested.slice_id,
      proof_of_priority_hash: proof.merkle_root,
      ...(api.mode === "live"
        ? {
            party_a_lab: offered.owner_lab_id,
            party_b_lab: requested.owner_lab_id,
          }
        : {}),
    });
    if (gen !== operationGeneration.current) return;
    setExchangeError("");
    setAgreement({
      proposal,
      offered,
      requested,
      approvals: [],
      settlementConfirmed: false,
    });
    addEvent("Barter proposal received", proposal.proposal_id);
  }
  async function approveNow(role: Role) {
    if (!agreement) return;
    const gen = operationGeneration.current;
    eligibleSlice(agreement.offered.slice_id);
    eligibleSlice(agreement.requested.slice_id);
    const response = await api.sign(agreement.proposal.proposal_id, role);
    if (gen !== operationGeneration.current) return;
    setAgreement((prev) =>
      prev ? applySignature(prev, role, response.status, response) : prev,
    );
    if (
      ![
        "PENDING_SECOND_PI_SIGNATURE",
        "SWAP_COMPLETED",
        "DUAL_SIGNED_AND_EXECUTED",
      ].includes(response.status)
    ) {
      throw new Error(
        `Authorization was not confirmed. Backend status: ${response.status}`,
      );
    }
    addEvent(
      ["SWAP_COMPLETED", "DUAL_SIGNED_AND_EXECUTED"].includes(response.status)
        ? "Exchange settlement confirmed"
        : "Human PI approval recorded",
      api.mode === "mock"
        ? "Simulated authorization response"
        : response.status,
      "success",
    );
  }
  async function restoreExchangeAccess() {
    try {
      await withOperation(async () => {
        if (!agreement?.settlementConfirmed || !api.poll) return;
        const response = await api.poll(agreement.proposal.proposal_id, activeLab);
        if (response.expired) {
          setAgreement(undefined);
          throw new Error("This agreement has expired. Propose a new exchange.");
        }
        setExchangeError("");
        addEvent("Exchange access restored", activeLab, "success");
      });
    } catch (error) {
      setExchangeError(errorText(error));
    }
  }
  async function stakeNow(input: VaultRequest) {
    const gen = operationGeneration.current;
    eligibleSlice(input.slice_id);
    const response = await api.stake(input);
    if (gen === operationGeneration.current) {
      setVaultResults((previous) => ({ ...previous, [input.slice_id]: response }));
      addEvent(
        "Vault deposit recorded",
        `${response.minted_scicredit} SciCredit · ${api.mode === "mock" ? "simulated" : "backend response"}`,
        "success",
      );
    }
    // The deposit is confirmed even when its follow-up balance read fails.
    // The wallet exposes a separate read-only retry without repeating the deposit.
    await refreshWallet().catch(() => {});
    return response;
  }
  async function resetNow() {
    setResetting(true);
    setResetError("");
    try {
      await api.reset();
      operationGeneration.current++;
      attRequest.current++;
      setResults({});
      setAgreement(undefined);
      setExchangeError("");
      setVaultResults({});
      walletRequest.current++;
      setWallet(undefined);
      setDeliveries({});
      setPurchaseSlice(undefined);
      setRecord(undefined);
      setModal(false);
      setEvents([]);
      setScene(undefined);
      setSearch("");
      setFilter("all");
      setSelected("slice_catalysis_oer_nife_001");
      setCompilerSliceId(undefined);
      setView("overview");
      setGeneration((v) => v + 1);
    } catch (e) {
      setResetError(errorText(e));
    } finally {
      setResetting(false);
    }
  }
  function showScene(index: number) {
    setScene(index);
    navigate(scenes[index][0]);
    if (index === 3 && agreement) setModal(true);
  }
  const mock = api.mode === "mock";
  const verified = slices.filter((s) => s.is_attested).length;
  const rejectedCount = Object.values(results).filter(isRejected).length;
  const compiler = (
    <PhysicsCompilerConsole
      slices={slices}
      mode={api.mode}
      initialSliceId={compilerSliceId}
      results={results}
      onVerify={verify}
      onInspect={inspect}
      activeLab={activeLab}
      onReview={api.review ? review : undefined}
    />
  );
  const exchange = (
    <BarterNegotiationCard
      slices={slices}
      agreement={agreement}
      onPropose={propose}
      onReview={() => setModal(true)}
      mock={mock}
    />
  );
  const filtered = slices.filter(
    (s) =>
      (filter === "all" || s.domain === filter) &&
      `${s.title} ${translate(s.title, "zh")} ${s.slice_id}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebar ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("overview");
          }}
        >
          <span className="brand-mark">
            <Box size={24} strokeWidth={1.6} />
          </span>
          <span>
            {t("SciExchange")}
            <small>{t("SCIENTIFIC DATA FABRIC")}</small>
          </span>
        </a>
        <button
          className="icon-button mobile-close"
          aria-label={t("Close navigation")}
          onClick={() => setSidebar(false)}
        >
          <X size={20} />
        </button>
        <div className="workspace-label">
          <span className="workspace-icon">
            <FlaskConical size={17} />
          </span>
          <div>
            {t("Research workspace")}
            <small>{t("OSI Hackathon 2026")}</small>
          </div>
          <span className="small muted">{t("⌘")}</span>
        </div>
        <p className="nav-label">{t("WORKSPACE")}</p>
        <nav aria-label={t("Main navigation")}>
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`nav-item ${view === item.id ? "active" : ""}`}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={17} />
              <span>{t(item.label)}</span>
              {item.id === "compiler" && rejectedCount > 0 && (
                <span className="nav-count">{rejectedCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-secondary">
          <p className="nav-label">{t("PROJECT")}</p>
          <button
            className={`nav-item ${view === "project" ? "active" : ""}`}
            onClick={() => navigate("project")}
          >
            <BookOpen size={17} />
            {t("Project overview")}
            <ArrowUpRight size={13} />
          </button>
          <button className="nav-item" onClick={() => showScene(0)}>
            <Play size={16} />
            {t("Demo walkthrough")}
            <span className="small muted">{t("6")}</span>
          </button>
        </div>
        <div className="sidebar-bottom">
          <div className="network-status">
            <span className="status-dot" />
            <span>
              {t(mock ? "Offline demo environment" : "Live API configured")}
            </span>
          </div>
          <p>
            {t(
              mock
                ? "All results are simulated fixtures."
                : "Server connection required for operations.",
            )}
          </p>
          <div className="sidebar-footer">
            <span className="mono">{t("v1.0 / OSI 2026")}</span>
            <button
              aria-label={t("Open project help")}
              className="icon-button"
              onClick={() => navigate("project")}
            >
              <CircleHelp size={16} />
            </button>
          </div>
        </div>
      </aside>
      {sidebar && (
        <button
          className="sidebar-scrim"
          aria-label={t("Close navigation")}
          onClick={() => setSidebar(false)}
        />
      )}
      <div className="main-shell">
        <button
          className="mobile-menu icon-button"
          aria-label={t("Open navigation")}
          onClick={() => setSidebar(true)}
        >
          <Menu size={22} />
        </button>
        <HeaderNavbar
          page={t(
            view === "project"
              ? "Project overview"
              : navigation.find((n) => n.id === view)!.label,
          )}
          mock={mock}
          resetting={resetting}
          busy={operationBusy}
          onReset={() => void reset()}
          activeLab={api.mode === "live" ? activeLab : undefined}
          labs={Array.from(
            new Set(
              slices
                .map((slice) => slice.owner_lab_id)
                .filter((address): address is string => !!address),
            ),
          )}
          onLabChange={changeLab}
        />
        <main key={generation}>
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                <span /> {t("OPEN SCIENTIFIC INTELLIGENCE")}
                {t(" ")}
                <span className="slash">{t("/")}</span> {t("RESEARCH CONSOLE")}
              </div>
              <h1>{t(pageCopy[view][0])}</h1>
              <p>{t(pageCopy[view][1])}</p>
            </div>
            <div className="page-actions">
              {view !== "marketplace" && (
                <button
                  className="button primary"
                  onClick={() => navigate("marketplace")}
                >
                  <ShoppingCart size={15} />
                  {t("Buy data with SciCredit")}
                </button>
              )}
              <button className="button" onClick={() => showScene(0)}>
                <Play size={14} />
                {t("Start walkthrough")}
                <ArrowUpRight size={14} />
              </button>
            </div>
          </div>
          {t(
            resetError && (
              <ErrorNotice error={resetError} retry={() => void reset()} />
            ),
          )}
          {exchangeError && <ErrorNotice error={exchangeError} />}
          {scene !== undefined && (
            <div className="scene-banner">
              <span className="scene-number">
                {t(String(scene + 1).padStart(2, "0"))} {t("/ 06")}
              </span>
              <div className="scene-content">
                <strong>{t(scenes[scene][1])}</strong>
                <p>{t(scenes[scene][2])}</p>
              </div>
              <div
                className="scene-pills"
                role="tablist"
                aria-label={t("Walkthrough scenes")}
              >
                {scenes.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={`scene-pill ${scene === idx ? "active" : ""}`}
                    onClick={() => showScene(idx)}
                    title={t(s[1])}
                  >
                    <span>{String(idx + 1).padStart(2, "0")}</span>
                  </button>
                ))}
              </div>
              <div className="scene-controls">
                <button
                  className="icon-button"
                  aria-label={t("Previous scene")}
                  disabled={scene === 0}
                  onClick={() => showScene(scene - 1)}
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="button"
                  onClick={() =>
                    scene === 5 ? setScene(undefined) : showScene(scene + 1)
                  }
                >
                  {t(scene === 5 ? "Finish" : "Next scene")}
                  <ChevronRight size={15} />
                </button>
                <button
                  className="icon-button"
                  aria-label={t("Close walkthrough")}
                  onClick={() => setScene(undefined)}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <Loading />
          ) : catalogError ? (
            <ErrorNotice
              error={catalogError}
              retry={() => void loadCatalog()}
            />
          ) : (
            <>
              {view === "overview" && (
                <>
                  <div className="stat-grid">
                    {[
                      {
                        label: "Scientific slices",
                        value: String(slices.length).padStart(2, "0"),
                        detail: mock
                          ? "Across two research domains"
                          : "Catalog research domains",
                        icon: Database,
                      },
                      {
                        label: "Attested slices",
                        value: String(verified).padStart(2, "0"),
                        detail: mock
                          ? "Demonstration attestations"
                          : "Reported by the catalog",
                        icon: ShieldCheck,
                      },
                      {
                        label: "Active agreements",
                        value: agreement ? "01" : "00",
                        detail: agreement?.settlementConfirmed
                          ? "Settlement confirmed"
                          : "Human authorization required",
                        icon: ArrowDownLeft,
                      },
                      {
                        label: "Safety interventions",
                        value: String(rejectedCount).padStart(2, "0"),
                        detail: rejectedCount
                          ? "Rejected by verification"
                          : "Run the adversarial slice",
                        icon: Fingerprint,
                      },
                    ].map((stat, i) => (
                      <div className="stat-card" key={stat.label}>
                        <div className="row-between">
                          <span>{t(stat.label)}</span>
                          <stat.icon size={17} />
                        </div>
                        <strong>
                          {t(stat.value)}
                          <span className={`stat-indicator indicator-${i}`}>
                            <Activity size={16} />
                          </span>
                        </strong>
                        <p>{t(stat.detail)}</p>
                      </div>
                    ))}
                  </div>
                  <div className="section-divider">
                    <span>{t("THE RESEARCH PIPELINE")}</span>
                    <span>{t("Verify → Attest → Exchange → Analyze")}</span>
                  </div>
                  <div
                    className="pipeline-stepper"
                    aria-label={t("The research pipeline")}
                  >
                    <button
                      type="button"
                      className="pipeline-step"
                      onClick={() => navigate("compiler")}
                    >
                      <span className="step-num">01</span>
                      <Terminal size={15} className="step-icon" />
                      <span className="step-info">
                        <strong>{t("Formal physical compiler")}</strong>
                        <small>
                          {rejectedCount > 0
                            ? `${rejectedCount} ${t("Rejected")}`
                            : t("Numerical checks")}
                        </small>
                      </span>
                    </button>
                    <ArrowRight size={14} className="pipeline-arrow" />
                    <button
                      type="button"
                      className="pipeline-step"
                      onClick={() => navigate("provenance")}
                    >
                      <span className="step-num">02</span>
                      <GitBranch size={15} className="step-icon" />
                      <span className="step-info">
                        <strong>{t("Priority attestation")}</strong>
                        <small>
                          {verified} {t("available")}
                        </small>
                      </span>
                    </button>
                    <ArrowRight size={14} className="pipeline-arrow" />
                    <button
                      type="button"
                      className="pipeline-step"
                      onClick={() => navigate("exchange")}
                    >
                      <span className="step-num">03</span>
                      <ArrowDownLeft size={15} className="step-icon" />
                      <span className="step-info">
                        <strong>{t("Reciprocal barter")}</strong>
                        <small>
                          {t(agreement?.settlementConfirmed
                            ? "Settled"
                            : "Human multi-sig")}
                        </small>
                      </span>
                    </button>
                    <ArrowRight size={14} className="pipeline-arrow" />
                    <button
                      type="button"
                      className="pipeline-step"
                      onClick={() => navigate("analytics")}
                    >
                      <span className="step-num">04</span>
                      <Activity size={15} className="step-icon" />
                      <span className="step-info">
                        <strong>{t("Tensor analytics")}</strong>
                        <small>LSV & dQ/dV</small>
                      </span>
                    </button>
                  </div>
                  <div className="overview-grid">
                    <DualDomainAnalytics
                      key={activeLab}
                      api={api}
                      compact
                      onExpand={() => navigate("analytics")}
                    />
                    <Panel
                      title={t("Exchange readiness")}
                      eyebrow={t("Human-governed data sharing")}
                      action={<Network size={17} className="muted" />}
                    >
                      <div className="readiness-visual">
                        <div className="readiness-lab">
                          <span>
                            <FlaskConical size={23} />
                          </span>
                          <strong>{t("Lab A")}</strong>
                          <small>{t("Electrocatalysis")}</small>
                        </div>
                        <div className="readiness-connection">
                          <span />
                          <LockKeyhole size={20} />
                          <span />
                        </div>
                        <div className="readiness-lab">
                          <span>
                            <Activity size={23} />
                          </span>
                          <strong>{t("Lab B")}</strong>
                          <small>{t("Battery engineering")}</small>
                        </div>
                      </div>
                      <div className="readiness-checks">
                        <div>
                          <Check size={15} />
                          <span>{t("Complementary scientific domains")}</span>
                        </div>
                        <div>
                          {verified >= 2 ? (
                            <Check size={15} />
                          ) : (
                            <LockKeyhole size={15} />
                          )}
                          <span>{t("Public attestation records")}</span>
                          <small>
                            {verified} {t("available")}
                          </small>
                        </div>
                        <div>
                          <LockKeyhole size={15} />
                          <span>{t("Bilateral Human PI approval")}</span>
                          <small>
                            {agreement?.approvals.length || 0} {t("/ 2")}
                          </small>
                        </div>
                      </div>
                      <div className="readiness-note">
                        <span className="status-dot" />
                        {t(" ")}
                        {t(
                          agreement?.settlementConfirmed
                            ? "Adapter-confirmed settlement"
                            : "Data stays locked until settlement is confirmed.",
                        )}
                      </div>
                      <button
                        className="button primary full-width"
                        onClick={() => navigate("exchange")}
                      >
                        {t(
                          agreement
                            ? "Continue exchange"
                            : "Open exchange workspace",
                        )}
                        <ArrowRight size={15} />
                      </button>
                      <p className="small muted center">
                        {t(
                          mock
                            ? "Simulated protocol · no real data is released"
                            : "Backend settlement is authoritative",
                        )}
                      </p>
                    </Panel>
                  </div>
                  <Panel
                    title={t("Scientific slice catalog")}
                    eyebrow={t("Your research assets")}
                    action={
                      <Badge>
                        {slices.length} {t("slices")} · {t("SciCredit")}:{" "}
                        {wallet ? `${wallet.balance} SC` : t("Unavailable")}
                      </Badge>
                    }
                  >
                    <div className="catalog-toolbar">
                      <div
                        className="segmented"
                        aria-label={t("Catalog domain filter")}
                      >
                        {[
                          ["all", "All slices"],
                          ["electrocatalysis", "Electrocatalysis"],
                          ["battery_cycling", "Battery cycling"],
                          ...(!mock
                            ? [
                                [
                                  "hydrothermal_synthesis",
                                  "Hydrothermal synthesis",
                                ],
                              ]
                            : []),
                        ].map(([id, label]) => (
                          <button
                            aria-pressed={filter === id}
                            key={id}
                            onClick={() => setFilter(id)}
                          >
                            {t(label)}
                          </button>
                        ))}
                      </div>
                      <input
                        type="search"
                        aria-label={t("Search scientific slices")}
                        placeholder={t("Search slices…")}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t("DATASET / SLICE")}</th>
                            <th>{t("DOMAIN")}</th>
                            <th>{t("CLASSIFICATION")}</th>
                            <th>{t("TRUST STATUS")}</th>
                            <th>{t("SCICREDIT")}</th>
                            <th>
                              <span className="sr-only">{t("Action")}</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((s) => (
                            <tr key={s.slice_id}>
                              <td>
                                <div className="dataset-cell">
                                  <span
                                    className={`dataset-icon ${s.domain === "battery_cycling" ? "blue" : ""}`}
                                  >
                                    <FileCheck2 size={18} />
                                  </span>
                                  <div>
                                    <strong>{t(s.title)}</strong>
                                    <small>{t(s.slice_id)}</small>
                                  </div>
                                </div>
                              </td>
                              <td>
                                {t(
                                  s.domain === "electrocatalysis"
                                    ? "Electrocatalysis"
                                    : s.domain === "battery_cycling"
                                      ? "Battery cycling"
                                      : "Hydrothermal synthesis",
                                )}
                              </td>
                              <td>
                                <span className="classification">
                                  {t(
                                    s.data_classification === "golden"
                                      ? "Golden reference"
                                      : s.data_classification === "experimental_reference"
                                        ? "Experimental reference"
                                      : s.data_classification ===
                                          "dark_matter_failure"
                                        ? "Failure data"
                                        : "Adversarial fixture",
                                  )}
                                </span>
                              </td>
                              <td>
                                <Badge
                                  tone={
                                    isRejected(getOwn(results, s.slice_id)) || s.compiler_status === "REJECTED"
                                      ? "danger"
                                      : s.is_attested
                                        ? "success"
                                        : "warning"
                                  }
                                >
                                  {t(
                                    isRejected(getOwn(results, s.slice_id)) || s.compiler_status === "REJECTED"
                                      ? "Rejected"
                                      : s.is_attested
                                        ? s.version ? "Human admission approved" : "Attested"
                                        : s.compiler_status === "REVIEW_REQUIRED" ? "Scientific review required" : "Unverified",
                                  )}
                                </Badge>
                              </td>
                              <td className="mono">
                                {t(String(s.price_scicredit))}
                                <span className="muted"> {t("SC")}</span>
                              </td>
                              <td>
                                <button
                                  className="icon-button"
                                  aria-label={t(`Inspect ${s.title}`)}
                                  onClick={() => {
                                    if (!s.is_attested) {
                                      setCompilerSliceId(s.slice_id);
                                      navigate("compiler");
                                    } else inspect(s.slice_id);
                                  }}
                                >
                                  <ArrowUpRight size={17} />
                                </button>
                                <button
                                  className="button"
                                  disabled={
                                    (!canReadOwn(s) &&
                                      !isEligible(
                                        s,
                                        getOwn(results, s.slice_id),
                                      )) ||
                                    operationBusy
                                  }
                                  aria-label={`${t(accessLabel(s))}: ${t(s.title)}`}
                                  onClick={() => setPurchaseSlice(s)}
                                >
                                  {t(accessLabel(s))}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {filtered.length === 0 && (
                        <Empty>{t("No slices match your search.")}</Empty>
                      )}
                    </div>
                    <footer className="catalog-footer">
                      <span>
                        <span className="status-dot" />
                        {t(
                          mock
                            ? "Deterministic fixtures · not experimental measurements"
                            : "Metadata returned by the live catalog",
                        )}
                      </span>
                      <span>
                        {filtered.length} {t("of")} {slices.length}{" "}
                        {t("records")}
                      </span>
                    </footer>
                  </Panel>
                  <div className="overview-bottom">
                    <Panel
                      title={t("Verification checkpoint")}
                      eyebrow={t("Trust before exchange")}
                    >
                      <div className="checkpoint">
                        <div className="icon-box">
                          <Terminal size={23} />
                        </div>
                        <div>
                          <h3>
                            {t(
                              mock
                                ? "A dataset claims 108.2% efficiency."
                                : "Check the submitted efficiency against conservation limits.",
                            )}
                          </h3>
                          <p>
                            {t(
                              "Inspect the adversarial OER fixture and see how physical constraints reject it.",
                            )}
                          </p>
                        </div>
                        <button
                          className="button"
                          onClick={() => navigate("compiler")}
                        >
                          {t("Open compiler")}
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </Panel>
                    <Panel
                      title={t("Workspace activity")}
                      action={
                        <span className="small muted">{t("THIS SESSION")}</span>
                      }
                    >
                      {events.length ? (
                        events.slice(0, 3).map((event) => (
                          <div className="event" key={event.id}>
                            <span className={`event-dot ${event.tone}`} />
                            <div>
                              <strong>{t(event.title)}</strong>
                              <small>{t(event.detail)}</small>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="event">
                          <span className="event-dot" />
                          <div>
                            <strong>{t("Workspace initialized")}</strong>
                            <small>
                              {t(
                                mock
                                  ? "Demo fixtures ready. Begin with physics verification."
                                  : "Live API mode selected.",
                              )}
                            </small>
                          </div>
                        </div>
                      )}
                    </Panel>
                  </div>
                </>
              )}
              {view === "compiler" && (
                <div className="detail-grid">
                  {compiler}
                  <Panel
                    title={t("Verification protocol")}
                    eyebrow={t("What the compiler checks")}
                  >
                    <div className="protocol-list">
                      {[
                        [
                          "01",
                          "Physical invariants",
                          "Conservation constraints and domain-specific consistency.",
                        ],
                        [
                          "02",
                          "Instrument validity",
                          "Resistance artifacts and calibration diagnostics.",
                        ],
                        [
                          "03",
                          "Untrusted metadata",
                          "Injection and chemical safety alerts from the backend.",
                        ],
                        [
                          "04",
                          "Scientific attestation",
                          "A successful result may reference a priority attestation.",
                        ],
                      ].map(([n, title, description]) => (
                        <div key={n}>
                          <span className="mono">{t(n)}</span>
                          <div>
                            <h3>{t(title)}</h3>
                            <p>{t(description)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="notice warning">
                      <ShieldCheck size={16} />
                      <span>
                        {t(
                          mock
                            ? "Offline fixtures simulate the compiler response. No scientific calculation or formal proof runs in the browser."
                            : "The backend owns scientific validation. Submit complete slice JSON; this frontend displays its response.",
                        )}
                      </span>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("provenance")}
                    >
                      {t("Inspect provenance")}
                      <ArrowRight size={14} />
                    </button>
                  </Panel>
                </div>
              )}
              {view === "marketplace" && (
                <DataMarketplace
                  slices={slices}
                  wallet={wallet}
                  deliveries={deliveries}
                  busy={operationBusy}
                  mock={mock}
                  activeLab={mock ? undefined : activeLab}
                  onBuy={setPurchaseSlice}
                  onVault={() => navigate("vault")}
                  onRefreshWallet={refreshWallet}
                />
              )}
              {view === "provenance" && (
                <AttestationDagGraph
                  slices={slices}
                  selected={selected}
                  onSelect={setSelected}
                  record={record}
                  verification={getOwn(results, selected)}
                  loading={attLoading}
                  error={attError}
                  onRetry={() => void loadAttestation(selected)}
                  mock={mock}
                  proposalId={
                    agreement &&
                    (selected === agreement.offered.slice_id ||
                      selected === agreement.requested.slice_id)
                      ? agreement.proposal.proposal_id
                      : undefined
                  }
                />
              )}
              {view === "exchange" && (
                <div className="exchange-page">
                  {exchange}
                  <Panel
                    title={t("Authorization & settlement")}
                    eyebrow={t("Protocol state")}
                  >
                    <div className="settlement-stages">
                      {[
                        {
                          title: "Agent proposal",
                          detail:
                            agreement?.proposal.proposal_id ||
                            "Not yet proposed",
                          done: !!agreement,
                        },
                        {
                          title: "Lab A Human PI",
                          detail: agreement?.approvals.includes("pi_proposer")
                            ? "Approval recorded"
                            : "Awaiting approval",
                          done: !!agreement?.approvals.includes("pi_proposer"),
                        },
                        {
                          title: "Lab B Human PI",
                          detail: agreement?.approvals.includes("pi_target")
                            ? "Approval recorded"
                            : "Awaiting approval",
                          done: !!agreement?.approvals.includes("pi_target"),
                        },
                        {
                          title: "Settlement confirmation",
                          detail: agreement?.settlementConfirmed
                            ? mock
                              ? "Simulated adapter confirmation"
                              : "Confirmed by backend"
                            : "Data release locked",
                          done: !!agreement?.settlementConfirmed,
                        },
                      ].map((step) => (
                        <div key={step.title}>
                          <span
                            className={`stage-icon ${step.done ? "done" : ""}`}
                          >
                            {step.done ? (
                              <Check size={16} />
                            ) : (
                              <LockKeyhole size={15} />
                            )}
                          </span>
                          <div>
                            <strong>{t(step.title)}</strong>
                            <small>{t(step.detail)}</small>
                          </div>
                        </div>
                      ))}
                    </div>
                    {agreement && (
                      <button
                        className="button full-width"
                        onClick={() => setModal(true)}
                      >
                        {t("Review agreement")}
                        <ArrowUpRight size={14} />
                      </button>
                    )}
                    {!mock && agreement?.settlementConfirmed &&
                      [agreement.offered.owner_lab_id, agreement.requested.owner_lab_id].includes(activeLab) && (
                      <button
                        className="button full-width"
                        disabled={operationBusy}
                        onClick={() => void restoreExchangeAccess()}
                      >
                        {t("Restore exchange access")}
                      </button>
                    )}
                  </Panel>
                </div>
              )}
              {view === "analytics" && (
                <DualDomainAnalytics key={activeLab} api={api} />
              )}
              {view === "vault" && (
                <div className="detail-grid">
                  <DataVault
                    api={api}
                    slices={slices}
                    results={vaultResults}
                    onStake={stake}
                  />
                  <CreditWallet wallet={wallet} mock={mock} onRefresh={refreshWallet} />
                </div>
              )}
              {view === "project" && (
                <>
                  <div className="project-hero">
                    <span className="brand-mark large">
                      <Box size={40} strokeWidth={1.3} />
                    </span>
                    <p className="eyebrow">
                      {t("SCIEXCHANGE / OSI HACKATHON 2026")}
                    </p>
                    <h2>
                      {t("Make scientific data")}
                      <br />
                      <span>{t("worthy of trust.")}</span>
                    </h2>
                    <p>
                      {t(
                        "Physical verification, traceable evidence and human-governed exchange.",
                      )}
                      <br />
                      {t(
                        "A research workspace for connecting scientific knowledge across laboratories.",
                      )}
                    </p>
                    <a
                      className="button primary"
                      href="https://github.com/Nine-Three-Cattery/SciExchange"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("Explore the repository")}
                      <ArrowUpRight size={15} />
                    </a>
                  </div>
                  <div className="project-pillars">
                    {[
                      [
                        ShieldCheck,
                        "Verify",
                        "Backend-generated diagnostics make physical constraints visible.",
                      ],
                      [
                        GitBranch,
                        "Trace",
                        "Inspect slice records and their scientific attestations.",
                      ],
                      [
                        LockKeyhole,
                        "Authorize",
                        "Two Human PIs retain control over bilateral exchange.",
                      ],
                    ].map(([Icon, title, description]) => {
                      const Glyph = Icon as typeof ShieldCheck;
                      return (
                        <Panel
                          key={String(title)}
                          title={t(String(title))}
                          action={<Glyph size={20} />}
                        >
                          <p className="section-description">
                            {t(String(description))}
                          </p>
                        </Panel>
                      );
                    })}
                  </div>
                  <div className="notice">
                    <Network size={18} />
                    <span>
                      {t(
                        "React + TypeScript workspace → typed API adapter → Member A gateway and settlement → Member B verification and analytics.",
                      )}
                      {t(" ")}
                      {t(
                        mock
                          ? "This session uses simulated frontend fixtures."
                          : "Live mode uses backend-authorized data and numerical results.",
                      )}
                    </span>
                  </div>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Box size={13} />
              {t("SciExchange")}
              <span className="muted">{t("/")}</span>{" "}
              {t("Open Scientific Intelligence")}
            </span>
            <span className="mono">
              {t(mock ? "DEMO ENVIRONMENT" : "LIVE API ENVIRONMENT")}
              <span className="footer-dot">{t("·")}</span>{" "}
              {t("MEMBER C WORKSPACE")}
            </span>
          </footer>
        </main>
      </div>
      {purchaseSlice && (
        <DataPurchaseModal
          key={purchaseSlice.slice_id}
          slice={purchaseSlice}
          api={api}
          wallet={wallet}
          owned={getOwn(deliveries, purchaseSlice.slice_id)}
          onAccess={access}
          onPurchase={purchase}
          onClose={() => setPurchaseSlice(undefined)}
          onVault={() => {
            setPurchaseSlice(undefined);
            navigate("vault");
          }}
        />
      )}
      {modal && agreement && (
        <HumanDualSignModal
          agreement={agreement}
          mock={mock}
          onClose={() => setModal(false)}
          onApprove={approve}
        />
      )}
      <SignatureDialog />
    </div>
  );
}
