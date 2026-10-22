<div align="center">

# 🔬⚡ SciExchange
### Zero-Trust Scientific Data Fabric, Physical Invariant Compiler & Data Barter Protocol for AI for Science

*Engineered for the **Open Scientific Intelligence (OSI) Hackathon 2026** (formerly Materials Science & Chemistry LLM Hackathon).*  
*Inspired by Terence Tao's Math 2.0, Lean 4 Formal Verification, and Physlib.*

<p align="center">
  <a href="README.md"><b>English</b></a> •
  <a href="README_CN.md"><b>简体中文</b></a>
</p>

[![Hackathon](https://img.shields.io/badge/Hackathon-OSI%202026-6366F1?style=for-the-badge&logo=target&logoColor=white)](#)
[![Protocol](https://img.shields.io/badge/Protocol-x402%20%26%20Data%20Barter-06B6D4?style=for-the-badge&logo=lightning&logoColor=white)](#)
[![Kernel](https://img.shields.io/badge/Kernel-Python%20Numerical%20Checks-10B981?style=for-the-badge&logo=shield&logoColor=white)](#)
[![Governance](https://img.shields.io/badge/Governance-HITL%20Dual--Signing-F59E0B?style=for-the-badge&logo=auth0&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-Apache--2.0-slate?style=for-the-badge)](LICENSE)

</div>

**Current implementation:** the repository contains a runnable Python/FastAPI gateway, numerical scientific checks, Ed25519 PI authorization, and local SciCredit settlement. `FORMAL_PROOF_VALID` is the retained API name for passed numerical protocol checks. Lean-style diagnostics are a presentation format; no Lean kernel or formalized Lean scientific specification is executed.

The five seed datasets are **deterministic synthetic test fixtures generated from project-specified parameters**. They are neither imported OC22/Severson source files nor calibrated reproductions of those datasets. Their metadata records `source_type="synthetic_benchmark"` and `experimental_measurement=false`. See [the current backend guide](BACKEND_USAGE.md) for executable commands and API behavior.

The integrated frontend supports live gateway calls and an explicitly labeled offline demo. The v4 architecture and storyboard below also describe planned network features. The “10/90” framing is a motivation for the project, not a measured result of this implementation.

---

## 🌟 The Core Thesis: Unlocking Scientific Dark Matter & The Zero-Trust Challenge

In Terence Tao's **Math 2.0**, automated AI generates mathematical proofs in abundance, verified down to foundational axioms by **Lean 4**. In parallel, the scientific computing ecosystem has birthed **[Physlib](https://physlib.io/)** (formalizing physics laws & unit systems in Lean 4) and **[SciLean](https://github.com/lecopivo/SciLean)** (formalized scientific computing & automated differentiation).

However, **AI for Science (AI4S) faces a deeper causal dilemma**:

> *“Data scarcity in AI4S is not due to a lack of experimental generation. Rather, both the **10% Golden Data** (paper-worthy breakthroughs) and the **90% Negative Data** (failed runs defining physical boundaries) are trapped as **‘Scientific Dark Matter’** across isolated hard drives of decentralized labs worldwide.*  
> *When we build a DeSci liquidity fabric to bring this dark matter into the sunlight, a new grand challenge emerges: **How do we guarantee Zero-Trust physical verification and prevent academic fraud or poisoned data from corrupting AI foundation models?**”*

**SciExchange combines reciprocal data exchange with numerical checks of scientific invariants, taking inspiration from Lean's explicit verification approach.**

```
                                  ┌── 10% Golden Data ────> P2P Decentralized Matchmaking + A2A Barter + Human PI Dual-Sig
[ Physical Experimental Data ] ───┤                         (No public dumping; mutual bilateral barter & priority attestation)
                                  └── 90% Dark Matter ────> Declarative Physics Compiler + Slice Liquidity Vault
                                                            (Zero fear of getting scooped; debiasing AI models & monetizing sunk costs)
```

---

## ⚖️ Paradigm Shift: Beyond Naive Open Science

| Evaluation Dimension | Traditional Open Science (Naive Web2) | SciExchange (v4.0 Golden Reference) |
|---|---|---|
| **Underlying Motivation** | Altruism / Moral Plea *(Fails in practice)* | **Reciprocal Data Barter + Liquidity Vault + Sunk Cost Monetization** |
| **10% Golden Data** | Hoarded locally *(Fear of being scooped)* | **P2P Agent Negotiation + Proof of Priority + Human PI Dual-Signing** |
| **90% Dark Matter Data** | Thrown away as useless junk | **Compiled into Tensor-Ready Slices to eliminate AI survivorship bias** |
| **Trust Verification** | Blind trust / SHA-256 file checksums | **Declarative Invariant Compiler ($\Phi_{\text{OER}}$, $\Phi_{\text{Battery}}$) inspired by Lean 4** |
| **Data Quality Boundary** | Garbage in, garbage out | **Impedance & drift guardrails distinguish true negatives from operator errors** |
| **AI Security** | Vulnerable to poisoned CSV headers | **Automated CWC Schedule 1/2 Dual-Use & Indirect Prompt Injection Quarantine** |

---

## 🏛️ System Topology & The 4-Act Storyline

```
[ Lab A: Electrocatalysis OER ] ──┐
                                  ├──> [ Declarative Physics Invariant Kernel ] ──> [ Slice Liquidity Vault & x402 ]
[ Lab B: Battery Fast-Charging ] ─┘      (Physlib Dimensional Analysis & Laws)                   │
                                                                                                 ▼
[ Malicious Node (Fraud/Injection) ] ──> ❌ COMPILE_ERROR: THERMODYNAMICS_VIOLATED     [ Human-in-the-Loop Dual-Sig ]
                                                                                                 │
                                                                                                 ▼
                                                                                [ Lean Atlas-style DAG & Atomic Swap ]
```

1. **Act 1: Zero-Trust Compilation in Action**: A malicious node uploads a fabricated OER slice ($FE=108\%$ + embedded prompt injection). The compiler evaluates physical axioms, flags thermodynamic violation, quarantines the injection, and logs diagnostic errors.
2. **Act 2: Autonomous A2A Discovery & Barter Negotiation**: Lab A (Electrocatalysis) and Lab B (Battery Fast-Charging) discover complementary needs. Agents negotiate an automated **Data-for-Data Barter** terms agreement.
3. **Act 3: Human-in-the-Loop (HITL) Dual-Signing Governance**: The Agent generates an Executive Decision Card. The Principal Investigator (PI) signs with their private key, creating an aggregated **Dual-Signature (`Agent_Sig + Human_PI_Sig`)** to atomically authorize data release.
4. **Act 4: High-Dimensional Domain Analytics & Causal Guardrail**: Slices decrypt simultaneously. Lab A inspects battery $dQ/dV$ waterfall curves and knee points; Lab B inspects LSV polarization profiles and Tafel slopes ($b=42.5\text{ mV/dec}$, $\eta_{10}=240\text{ mV}$). A yellow Causal Guardrail alerts against covariate mismatch.

---

## 🚀 Key Technological Pillars

### 1. Physical Invariant Compiler, Inspired by Lean
- **Numerical Protocol Checks**: Computes measurement-derived quantities and checks the declared physical and operational constraints before issuing a local attestation.
- **Electrocatalysis Checks ($\Phi_{\text{OER}}$)**: Enforces $FE \le 100\%$, the protocol's active-OER threshold ($E \ge 1.229\text{V}$ vs RHE when $j > 0.5\text{ mA/cm}^2$), and Tafel linearity ($R^2 \ge 0.98$).
- **Battery Checks ($\Phi_{\text{Battery}}$)**: Enforces protocol Coulombic efficiency bounds ($98\% \sim 100\%$), checks charging $dQ/dV$, and evaluates the 10-cycle capacity trend.
- **Instrument Noise Guardrail**: Checks uncompensated resistance ($R_u \le 15\,\Omega$, $iR \ge 85\%$) and OCV reference drift ($\le 5\text{ mV}$), reporting operational failures separately from conservation failures.
- **Tensor-Ready Slices (IUPAC/ASE)**: Outputs standard tensors directly consumable by PyTorch `DataLoader`.

### 2. Proof of Priority & Anti-Scoop Protection
- Mints immutable, timestamped cryptographic attestation upon successful physical compilation.
- Guarantees priority authorship and citation royalty before public release.

### 3. Bilateral Data Barter & Slice Liquidity Vault
- **Bilateral Barter**: Direct data-for-data swaps between complementary research groups.
- **Atomic Fair Exchange Escrow**: Solves the classic Fair Exchange Dilemma via Merkle pre-commitments and aggregated dual-key release.
- **Slice Liquidity Vault**: Solves the "double coincidence of wants" by depositing verified slices to mint SciCredits or settle via x402 USDC micropayments (Cloudflare Virtual Wallets).

### 4. Human-in-the-Loop (HITL) Multi-Sig Dual-Signing
- Autonomous agents negotiate terms; final authorization requires human PI cryptographic signatures.
- Total control remains in the hands of human scientists.

---

## 🎬 3-Minute Video Screencast Storyboard

*Designed for high-impact 1080P/2K screencast submissions:*

| Shot & Timestamp | Visual Focus | Voiceover Summary |
|---|---|---|
| **Shot 1 (0:00 - 0:25)** | Full System Architecture & Tao's Math 2.0 quote | *“AI4S data is trapped as dark matter. SciExchange brings it to the light, verified by physics.”* |
| **Shot 2 (0:25 - 0:55)** | Malicious Slice Upload & Live Compiler Terminal | *“Watch the compiler catch fraud: Faradaic Efficiency 108% triggers a thermodynamic violation & injection quarantine.”* |
| **Shot 3 (0:55 - 1:30)** | Lab A & Lab B Agent Barter Negotiation Animation | *“Catalysis Agent meets Battery Agent. Instead of fiat, they execute an automated Data-for-Data Barter.”* |
| **Shot 4 (1:30 - 2:00)** | Human PI Executive Decision Card & Dual-Signing | *“AI negotiates, humans govern. Human PI signs with private key, unlocking atomic slice decryption.”* |
| **Shot 5 (2:00 - 2:35)** | Parallel Scientific Charts (Tafel & $dQ/dV$) | *“The synthetic benchmarks recover the specified Tafel slope and charge-curve peak. The knee estimate is reported only when supported by the observed trajectory.”* |
| **Shot 6 (2:35 - 3:00) ** | Open-source GitHub Badges & Hackathon Summary | *“SciExchange: Making the laws of physics the bedrock of machine trust.”* |

---

## ⚡ Quickstart & Local Reproduction

### 1. Prerequisites
- Python 3.10+ for the implemented backend

### 2. Backend & Physics Compiler
```bash
# Run from the repository root
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Generate the five explicitly synthetic benchmarks and local demo PI identities
python scripts/seed_slices.py
python scripts/setup_demo.py

# Run Physics Invariant Verification Tests
pytest tests/ -v

# Launch FastAPI Gateway
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 3. Demonstration and Frontend Integration

Run `python scripts/demo_exchange.py` in another terminal with the virtual environment activated to exercise the HTTP compilation, PI signing, and download flow. The API explorer is at `http://127.0.0.1:8000/docs`.

The dashboard is implemented under `frontend/`. Follow [the frontend guide](frontend/README.md) to run it against the real gateway, review and sign PI messages locally, or select offline mock mode. Live plots use authorized measurements and backend numerical results; synthetic provenance and verification scope remain explicit.

---

## 🔬 Academic Grounding & Seminal References

SciExchange's architecture directly builds upon peer-reviewed discoveries across materials AI, formal verification, electrocatalysis, and scientific sociology:

| Domain & Thesis | Key Reference & DOI | Direct Architectural Contribution to SciExchange |
|---|---|---|
| **90% Dark Matter in AI4S** | **Raccuglia et al. (2016)**<br>*Nature* 533, 73–76<br>[doi:10.1038/nature17439](https://doi.org/10.1038/nature17439) | Validates that **failed/unsuccessful reaction data** is vital for training generalizable AI models, proving the thesis of our **Data Liquidity Vault**. |
| **Academic Publication Bias** | **Fanelli, D. (2012)**<br>*Scientometrics* 90, 891–904<br>[doi:10.1007/s11192-011-0494-7](https://doi.org/10.1007/s11192-011-0494-7) | Documents the systemic disappearance of negative scientific results, demonstrating the urgent need for incentivized decentralized dark data sharing. |
| **Sociology of "Scooping"** | **Merton, R. K. (1957)**<br>*Am. Sociol. Rev.* 22(6), 635–659<br>[doi:10.2307/2089193](https://doi.org/10.2307/2089193) | Explains why scientists guard 10% golden data to protect scientific priority, justifying our **P2P Barter & Proof of Priority** over forced open dumps. |
| **Electrocatalysis Benchmarks** | **Tran et al. / Meta FAIR (2022)**<br>*ACS Catalysis* 12, 14068<br>[doi:10.1021/acscatal.2c05426](https://doi.org/10.1021/acscatal.2c05426) | Background reference for oxide electrocatalysis datasets. No OC22 file is imported by the current seed generator; its NiFe-LDH LSV traces are project-parameterized synthetic fixtures. |
| **Experimental Artifacts & False FE** | **Anantharaj et al. (2018)**<br>*Energy Environ. Sci.* 11, 744<br>[doi:10.1039/C7EE03457A](https://doi.org/10.1039/C7EE03457A) | Seminal critique revealing rampant errors in reported Tafel slopes, uncompensated $iR$ resistance, and false Faradaic efficiency ($FE > 100\%$) in literature. |
| **Battery Life Prediction** | **Severson et al. / Stanford & MIT (2019)**<br>*Nature Energy* 4, 383–391<br>[doi:10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8) | Background reference for the fast-charge LFP scenario. The current 100-cycle and within-cycle curves are generated mathematically; no measured Severson cell or lifetime is reproduced. |
| **Physics-Informed Verification** | **Karniadakis et al. (2021)**<br>*Nature Reviews Physics* 3, 422<br>[doi:10.1038/s42254-021-00314-5](https://doi.org/10.1038/s42254-021-00314-5) | Foundational theory on enforcing physical invariants and conservation principles within neural training pipelines. |
| **Formal Theorem Proving** | **de Moura & Ullrich (2021)**<br>*CADE 28*, LNCS 12699, 625–635<br>[doi:10.1007/978-3-030-79876-5_37](https://doi.org/10.1007/978-3-030-79876-5_37) | Inspiration for explicit verification and diagnostic presentation. The current compiler executes Python numerical checks, without a Lean proof engine or an encoded Lean scientific specification. |
| **Chemical Physics in Lean** | **Bobbin et al. (2024)**<br>*Digital Discovery* 3, 264–280<br>[doi:10.1039/d3dd00077j](https://doi.org/10.1039/d3dd00077j) | Pioneers formalizing thermodynamic relations and surface adsorption theories within the **Lean theorem prover**, providing direct peer-reviewed proof of concept for our compiler. |
| **Differential Tafel Analysis (DTA)** | **Corva et al. (2022)**<br>*ACS Catalysis* 12, 13805–13812<br>[doi:10.1021/acscatal.2c03581](https://doi.org/10.1021/acscatal.2c03581) | Formulates derivative-based Tafel analysis to eliminate subjective linear region selection, underpinning our automated `domain_analytics.py` engine. |
| **Polarization Pitfalls in Catalysis** | **Anantharaj et al. (2021)**<br>*ACS Energy Lett.* 6, 1607–1611<br>[doi:10.1021/acsenergylett.1c00608](https://doi.org/10.1021/acsenergylett.1c00608) | Critiques dynamic polarization curves for Tafel evaluation due to capacitance and uncompensated $iR$, directly justifying our compiler's steady-state and resistance checks. |
| **Data Integrity in Materials AI** | **Reeves-McLaren & Christensen (2025/2026)**<br>*J. Mater. Chem. A*<br>[doi:10.1039/D5TA05512A](https://doi.org/10.1039/D5TA05512A) | Addresses the grand challenge: balancing accelerated materials AI discovery with data integrity, reproducible provenance, and zero-trust verification. |
| **Scientific Misconduct & Benford's Law** | **Eckhartt et al. (2023)**<br>*Res. Integr. Peer Rev.* 8, 1<br>[doi:10.1186/s41073-022-00126-w](https://doi.org/10.1186/s41073-022-00126-w) | Establishes statistical forensics guidelines using multi-digit Benford's Law to automatically detect fabricated scientific data and machine-generated hallucinations. |
| **File Drawer Problem in Science** | **Rosenthal, R. (1979)**<br>*Psychological Bulletin* 86(3), 638–641<br>[doi:10.1037/0033-2909.86.3.638](https://doi.org/10.1037/0033-2909.86.3.638) | The foundational paper on the "file drawer problem", proving why unshared negative and failed research causes systematic epistemological bias across all sciences. |
| **Algorithmic Data Marketplaces** | **Agarwal, Dahleh, & Sarkar (2019)**<br>*ACM EC '19*, 709–710<br>[doi:10.1145/3328526.3329589](https://doi.org/10.1145/3328526.3329589) | Foundational mechanism design for data markets, solving peer-to-peer data valuation, Shapley allocations, and fair clearing without predatory intermediaries. |
| **Dual-Use AI Safety Guardrail** | **Urbina et al. (2022)**<br>*Nature Machine Intelligence* 4, 189<br>[doi:10.1038/s42256-022-00465-9](https://doi.org/10.1038/s42256-022-00465-9) | Proved generative AI can inadvertently suggest Chemical Weapons Convention (CWC) Schedule 1 neurotoxins, necessitating our automated dual-use filter. |
| **Autonomous Lab Injection Defense** | **Applied Intelligence (2026)**<br>*Appl. Intell.*<br>[doi:10.1007/s10015-026-01152-3](https://doi.org/10.1007/s10015-026-01152-3) | Formulates the Dual-LLM pattern for deterministic AI agent defense against indirect prompt injection in autonomous laboratory workflows. |
| **AI Barter & Market Microstructure** | **Linton, J. D. (2024)**<br>*SSRN* Electronic Journal<br>[doi:10.2139/ssrn.6177621](https://doi.org/10.2139/ssrn.6177621) | Explores the economic transition from primitive barter friction to decentralized, AI agent-mediated commerce, validating our **Multi-Agent Barter & Liquidity Vault** model. |

---

## 📚 Complete Technical Documentation

- ⚙️ **[Current Backend Usage (BACKEND_USAGE.md)](BACKEND_USAGE.md)**: Implemented API behavior, actual data provenance, local configuration, and runnable commands.
- 📑 **[System Whitepaper & Technical Specification (SciExchange_Handover.md)](SciExchange_Handover.md)**: Exhaustive mathematical formulation, Lean 4 analogies, schemas, and pitch notes.
- 🤖 **[Codex Master Implementation Guide (docs/CODEX_IMPLEMENTATION_GUIDE.md)](docs/CODEX_IMPLEMENTATION_GUIDE.md)**: Step-by-step phased engineering guide for AI code generation agents.
- ⚙️ **[Backend & Physics Compiler Architecture (docs/BACKEND_ARCHITECTURE.md)](docs/BACKEND_ARCHITECTURE.md)**: Detailed API contracts, axiomatic constraint engines, and x402 middleware.
- 🎨 **[Frontend & Visual Component Architecture (docs/FRONTEND_ARCHITECTURE.md)](docs/FRONTEND_ARCHITECTURE.md)**: Dark glassmorphic design system, DAG components, and interactive charts.
- 🔬 **[Framework & Dataset Research Findings (docs/research/FINDINGS.md)](docs/research/FINDINGS.md)**: Team B's reproducible mining results across 87 scientific data frameworks and 68 battery/catalysis datasets.
- 👥 **[3-Person Agile Collaboration Matrix (SciExchange_Task_Allocation.md)](SciExchange_Task_Allocation.md)**: Team roles, file ownership, and 48-hour delivery timeline.

---

<div align="center">
  <sub>Built with 🔬 for the Open Scientific Intelligence (OSI) Hackathon 2026. Distributed under the Apache-2.0 License.</sub>
</div>
