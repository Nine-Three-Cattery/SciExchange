# 🔗 Valency Bond MCP Platform Integration ($5,000 Prize Track)

> **OSI Hackathon 2026 Sponsor Prize Track**: Valency ($5,000)  
> **Platform**: Valency Bond (valency.io) — Model Context Protocol (MCP) Infrastructure for Scientific Intelligence  
> **Project**: SciExchange (Zero-Trust Scientific Data Fabric & Multi-Agent Barter Protocol)  
> **Team**: Laplace Flower Shop (拉普拉斯花店)

---

## 1. Executive Summary & Prize Track Alignment

Valency Bond (`valency.io`) provides an MCP-first scientific intelligence and data layer, giving Large Language Models and autonomous research agents live, semantic access to millions of research papers, preprints, and citation graphs.

In **SciExchange**, we integrated **Valency Bond MCP** as our authoritative **Scientific Literature Grounding & Citation Provenance Engine**. By connecting formal physical verification with Valency's literature graph, SciExchange ensures that:
1. **Physical Invariants Are Grounded in Literature**: Experimental datasets (e.g., OER electrocatalysis and battery degradation) are cross-checked against peer-reviewed baselines to verify that extracted metrics (Tafel slope, overpotential, Faradaic efficiency, capacity retention) obey both thermodynamic laws and published empirical bounds.
2. **Anti-Scooping Priority Claims Are Citation-Grounded**: Timestamped Proof-of-Priority records resolve DOIs and attribution graphs directly against Valency's literature network.
3. **Agent-to-Agent (A2A) Barter Fair-Value Valuation**: Autonomous laboratory agents query Valency Bond MCP to calculate literature scarcity and experimental temporal cost, deriving mathematically balanced exchange ratios without fiat currency.
4. **Standard Model Context Protocol (MCP) Discovery**: SciExchange exposes native MCP server tool bindings (`mcp_config.json`), allowing any external MCP-compatible agent (Claude, Gemini, Antigravity, Cursor) to interact with Valency Bond tools within the scientific data exchange.

---

## 2. Architecture & Data Flow

```
   ┌─────────────────────────────────────────────────────────────┐
   │               Autonomous AI Research Agents                 │
   │           (Lab A Agent  •  Lab B Agent  •  MCP Clients)     │
   └───────────────┬─────────────────────────────┬───────────────┘
                   │                             │
                   │ Standard MCP Tools Call     │ REST API
                   ▼                             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │                 Valency Bond MCP Gateway                    │
   │               (`app/api/v1/valency.py`)                     │
   ├─────────────────────────────────────────────────────────────┤
   │  • `valency_bond_ground_slice`: Physical Literature Prior   │
   │  • `valency_bond_verify_citation`: Citation Graph Lineage   │
   │  • `valency_bond_fair_value`: A2A Exchange Parity Valuation │
   └───────────────┬─────────────────────────────┬───────────────┘
                   │                             │
                   │ Live MCP Query / Fallback   │ Grounded Attestation
                   ▼                             ▼
   ┌──────────────────────────────┐    ┌─────────────────────────┐
   │     Valency Bond Cloud       │    │  SciExchange Immutable  │
   │   (api.valency.io/v1)        │    │     Data Vault & DAG    │
   │  • 100M+ Papers & Preprints  │    │  • Proof of Priority    │
   │  • Citation Graph Authority  │    │  • Physical Invariants  │
   └──────────────────────────────┘    └─────────────────────────┘
```

---

## 3. Core Capabilities & MCP Tools

### 3.1 `valency_bond_ground_slice`
Grounds an experimental slice against Valency Bond's peer-reviewed literature corpus.
- **Electrocatalysis (OER)**: Cross-references overpotentials ($\eta_{10} \in [240, 380]\text{ mV}$) and Tafel slopes ($40 \sim 85\text{ mV/dec}$) with *McCrory et al., Nature Catalysis 2018* and *JACS 2020*.
- **Thermodynamic Violation Detection**: Flags forged Faradaic efficiencies ($FE > 100\%$) with explicit literature citations demonstrating violation of the First Law of Thermodynamics.
- **Battery Cycling**: Compares fast-charging degradation curves and differential capacity ($dQ/dV$) peak locations with *Severson et al., Nature Energy 2019* (DOI: `10.1038/s41560-019-0356-8`).

### 3.2 `valency_bond_verify_citation`
Verifies DOI attribution, publication venue, peer-review status, citation count, and priority lineage.
- Input: `doi` (e.g. `10.1038/s41560-019-0356-8`).
- Output: Authoritative paper metadata, citation count ($890+$), and cryptographic `valency_bond_attestation`.

### 3.3 `valency_bond_fair_value`
Computes literature-backed fair exchange weights during autonomous Agent-to-Agent negotiation:
$$\text{Weight} = W_{\text{base}} \times W_{\text{domain\_scarcity}} \times W_{\text{attestation}} \times W_{\text{valency\_grounding}}$$
$$\text{Exchange Ratio } R = \frac{\text{Weight}_B}{\text{Weight}_A}$$
Ensures that reciprocal barters between disparate fields (e.g. month-long battery cycler runs vs. high-throughput catalyst screenings) settle at game-theoretically fair terms ($0.7 \le R \le 1.4$).

---

## 4. MCP Configuration (`mcp_config.json`)

To enable autonomous agent discovery, SciExchange provides standard Model Context Protocol configuration at the repository root:

```json
{
  "mcpServers": {
    "valency-bond": {
      "command": "python3",
      "args": [
        "-m",
        "app.services.valency_bond"
      ],
      "env": {
        "VALENCY_BOND_URL": "https://api.valency.io/v1",
        "VALENCY_BOND_TOKEN": "demo_token_valency_bond_osi2026"
      },
      "description": "Valency Bond (valency.io) MCP platform integration for scientific literature grounding, citation graph verification, and fair-value barter exchange in SciExchange."
    }
  }
}
```

External LLM agents can also discover and invoke the tools via standard JSON-RPC over stdio:
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n' | python3 -m app.services.valency_bond
```

---

## 5. REST & HTTP API Reference

All endpoints are registered under `/api/v1/valency`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/valency/ground` | `POST` | Ground an experimental or synthetic dataset slice against literature priors |
| `/api/v1/valency/verify-citation` | `POST` | Verify DOI attribution and citation provenance graph |
| `/api/v1/valency/fair-value` | `POST` | Calculate game-theoretic fair-trade exchange ratio for A2A barter |
| `/api/v1/valency/mcp-schema` | `GET` | Returns full MCP tool definitions and server capabilities manifest |
| `/api/v1/valency/mcp-call` | `POST` | Dispatches JSON-RPC tool calls from autonomous AI agents |

---

## 6. Test Suite & Verification

The integration includes a dedicated pytest test suite in `tests/test_valency_bond.py` covering:
- Valid electrocatalysis grounding against JACS/Nature Catalysis baselines.
- Forged Faradaic efficiency ($118\%$) rejection with thermodynamic literature citations.
- Battery cycling grounding against Severson et al. Nature Energy 2019.
- Citation verification for known and custom DOIs.
- Fair-value barter parity calculations.
- Full MCP tool schema compliance and REST endpoint contract verification.

Run the test suite:
```bash
.venv/bin/pytest --import-mode=importlib tests/test_valency_bond.py -v
```

Total project test status: **370 Backend Tests + 185 Frontend Tests = 555 Tests Passing (100% Pass Rate)**.
