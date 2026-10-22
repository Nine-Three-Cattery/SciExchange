# SciExchange — 项目系统设计白皮书与技术规范 (Whitepaper & Handover Specification)

**项目全称：** SciExchange: Zero-Trust Scientific Data Fabric, Physical Formal Compiler & Data Barter Protocol  
**一句话定位：** *受 Lean 4 形式化证明启发的去中心化科学数据流转网络——融合声明式物理守恒编译、学术优先权存证（Proof of Priority）、x402 与数据流动性金库（Data Vault）、跨学科以物易物（Data Barter）及人机双签（Dual-Signing）治理机制。*  
**文档版本：** v4.0（完整工业级参考实现版）— 2026 年 10 月，新加坡 OSI Hackathon  
**适用赛会：** Open Scientific Intelligence (OSI) Hackathon 2026  
**黄金参考基准（Golden Reference Benchmarks）：**
* **电催化领域**：基于 **Meta FAIR Open Catalyst Project (OC22)** 标准电催化水分解（OER: LSV 极化、Tafel 动力学与过电位）；
* **先进电池领域**：基于 **Stanford / MIT (Severson et al., Nature Energy 2019)** 快速充放电寿命预测基准；
* **形式化验证与量纲系统**：深度对齐 **Physlib (PhysLean)** 物理量纲体系与 **SciLean** 形式化计算哲学。

---

## 0. 核心愿景与理论基石（Philosophy & First Principles）

### 0.1 核心问题宣言：暗物质的觉醒与零信任防伪的终极命题
AI for Science 之所以面临高质量数据的极度稀缺：
* **不在于数据本身不存在**，而在于无论那 10% 真正能导向顶刊的黄金正向数据，还是那 90% 真实反映物理边界的失败实验数据，目前都作为**“科学暗物质”**，被死死封印在散落在世界各地单一实验室本地硬盘的孤岛中；
* **当 SciExchange 最终构建了去中心化科学（DeSci）的流动基座，通过合乎人性的以物易物与优先权存证，将原本藏在暗处的物理数据集中引渡到阳光下之后，新的终极挑战随之而来：**
  > **“在流动性喷涌的时代，人类与 AI 如何建立机器零信任的科学防伪与物理真伪验证底座？”**

如果只有流动性而缺乏零信任验证，开放数据池将瞬间沦为充斥着学术造假、操作事故与提示词投毒的污水沟；如果只有验证而缺乏去中心化流动性，科学研究又将重新退回各自为战的黑暗森林。

**SciExchange 正是这一因果矛盾的破局解：以 DeSci 激活全球暗物质流动，以 Lean 4 物理形式化编译捍卫科学真理。**

### 0.2 破局方案：尊重人之常情——物质科学的“10/90 双轨数据法则”
真实科研世界中，物质科学数据遵循残酷的 **10/90 法则**：**10% 是能导向顶刊的黄金正向数据，90% 则是失败、未达预期或无法发表的“暗物质数据”**。

SciExchange 的底层设计哲学不是违背人之常情去道德绑架科学家，而是**做科学家的朋友，提供对准人性的双轨破局机制**：

```
                                  ┌── 10% 顶刊黄金数据 ──> 去中心化安全撮合 + 双 Agent 谈判 + PI 双签以物易物 (防抢发、保署名、促合作)
[ 实验室物理实验数据要素池 ] ──────┤
                                  └── 90% 失败暗物质数据 ──> 物理形式化编译 + 存入流动性金库 (消除大模型幸存者偏差、沉没资产变现)
```

1. **针对 10% 的黄金正向数据：不做强迫公开，只做安全对等的科研接触与双签合作**
   * **痛点直击**：PI（课题组长）对正向数据的最大顾虑是**署名权与抢发风险**。
   * **SciExchange 策略**：系统绝不要求将黄金数据公网倾倒，而是作为去中心化中继网关：促成两个手握不同领域关键成果的实验室节点（如电催化 Lab A 与电池快充 Lab B）安全接触，由双方 Agent 完成需求博弈与谈判，最终经由**人类 PI 双签（Dual-Signing Multi-Sig）与学术优先权存证（Proof of Priority）**，以物易物对等互换或建立联合科研合作。
2. **针对 90% 的失败暗物质数据：变废为宝，供给科学大模型亟需的负样本**
   * **痛点直击**：大部分实验室认为不成功的数据毫无价值，直接丢弃在本地硬盘；然而，如果仅用少得可怜的正向数据训练 AI 基础模型，势必面临**数据严重不平衡与幸存者偏差（Survivorship Bias）**，导致泛化能力崩溃。
   * **SciExchange 策略**：这 90% 无法发表的失败数据，**课题组拥有零被抢发风险（Zero Scooping Fear）**！SciExchange 物理编译器对其进行形式化守恒清洗后，注入“切片流动性金库（Data Vault）”，为 AI for Science 基础模型提供极为罕见、真实反映物理失败边界的宝贵负样本，直接将实验室的“沉没成本”变现为研究算力与跨域切片额度！
3. **技术支柱闭环**：
   * **“Lean 4 for Science” 声明式物理编译内核**：公理化求解热力学与量纲系统，编译即物理守恒，把关数据真伪；
   * **安全守门人**：隔离文本与指令，过滤两用毒剂与间接提示词注入。

---

## 1. 物理形式化编译公理系统 (The Formal Physical Invariant Engine)

编译内核针对不同物理领域定义了声明式约束规范，不通过形式化求解的数据切片将被直接驳回并输出诊断日志：

### 1.1 电催化公理约束集 ($\Phi_{\text{Electrocatalysis}}$)
$$\Phi_{\text{OER}} := \begin{cases}
V_{\text{measured}} \ge E^\circ_{\text{Nernst}}(T, \text{pH}) = 1.229 - 0.0591 \times \text{pH} & (\text{热力学超电位下限}) \\
\frac{\partial j}{\partial V} \ge -\epsilon & (\text{阳极扫描电流单调性}) \\
\eta_{\text{Faradaic}} = \frac{n \cdot F \cdot \Delta n_{\text{O}_2}}{\int j \, dt \cdot A} \in [0.95, 1.00] & (\text{电荷守恒与法拉第定律}) \\
\chi^2_{\text{Tafel}} = \sum \left( \eta_i - (a + b \log_{10} j_i) \right)^2 \le \delta \quad (R^2 \ge 0.98) & (\text{微观电极活化动力学线性度})
\end{cases}$$

* **量纲检验（Physlib Dimensional Analysis）**：
  强制检验电位量纲 $[M^1 L^2 T^{-3} I^{-1}]$、电流密度量纲 $[I^1 L^{-2}]$。若参比电极未标定为可逆氢电极（RHE），直接报错 `TYPE_DIMENSION_ERROR: Missing RHE Calibration Offset`。

### 1.2 电池充放电公理约束集 ($\Phi_{\text{Battery}}$)
$$\Phi_{\text{Battery}} := \begin{cases}
\eta_{\text{Coulombic}} = \frac{Q_{\text{discharge}}}{Q_{\text{charge}}} \in [0.980, 1.005] & (\text{热力学活性锂容积守恒}) \\
V_{\text{cutoff\_min}} \le V(t) \le V_{\text{cutoff\_max}} & (\text{电解液氧化还原窗口限制}) \\
\frac{\partial Q_{\text{discharge}}}{\partial (\text{Cycle})} \le \sigma & (\text{退化单调性与跳水拐点二阶导判定})
\end{cases}$$

### 1.3 科学真阴性 vs 人为手残事故判别器 (Instrument Noise & Impedance Guardrail)
为了从根本上解决“失败数据是否包含大量研究生操作失误垃圾”的质疑，编译内核增加了**仪器有效性基准线公理**：
$$\Phi_{\text{Instrument}} := \begin{cases}
\text{iR-Compensation}_{\text{actual}} \ge 85\% \quad \text{and} \quad R_u \in [1.0, 50.0] \, \Omega & (\text{溶液未补偿欧姆阻抗守恒}) \\
|\Delta V_{\text{OCV}}| = |V_{\text{OCV, post}} - V_{\text{OCV, pre}}| \le 5.0 \, \text{mV} & (\text{参比电极电势零漂移基准}) \\
\text{SNR}(j(V)) \ge 25 \, \text{dB} & (\text{气泡脱离扰动与接触毛刺过滤})
\end{cases}$$
* **学术价值**：如果数据是因为电极没夹紧、气泡堆积或甘汞电极漏液导致的“假失败”，系统直接打上 `OPERATIONAL_ARTEFACT_REJECTED` 标签，绝不污染大模型；只有仪器标定完备、电解池处于标准态但催化剂材料本身表现差的**“高价值科学真阴性切片”**，才被允许入库！

### 1.4 IUPAC / ASE 规范化与直接张量化 (Canonical Tensor-Ready Slicing)
为了让换到切片的实验室无需手动编写特征转换代码，编译器在验证通过后自动输出遵循 IUPAC 与 ASE (Atomic Simulation Environment) 标准的 **Tensor-Ready 切片**：
* **电催化切片**：自动执行能斯特方程转换，将任意参比电极电位归一化为标态 $V_{\text{RHE}}$，将原始微安电流按电极几何面积转化为 $\text{mA/cm}^2$，并按 $1\text{ mV}$ 间距重采样插值，输出格式直接对接 PyTorch `Dataset`。
* **电池切片**：自动执行容量与极化对齐，输出标准退化状态张量 $\mathbf{X} \in \mathbb{R}^{100 \times 5}$（包含归一化容量、极化差分、库伦效率、内阻增长率）。

### 1.5 编译器级诊断输出示例 (Compiler Diagnostic Output)
当恶意节点上传法拉第效率 108%、未经 iR 补偿且含提示词投毒的切片时，编译器抛出如下专业诊断报告：
```text
[SciExchange-PhysCompiler] v4.0.1 (Lean4-Spirit Formal Engine)
ERROR in slice_catalysis_oer_fraud_002.csv (Line 42):
  Invariant Violation: Axiom of Charge Conservation (Faraday's Law)
  Constraint: FE(Q_actual, Q_theoretical) <= 1.0000 [Dimensionless]
  Evaluated:  FE = 1.0820 (Residual: +0.0820, Breach: 5.4σ anomaly)
  Physics Ref: Physlib.Electrodynamics.FaradayEfficiency

WARNING in hardware_channel.impedance:
  Uncompensated Resistance Ru = 124.5 Ω (> 50.0 Ω limit, iR-Compensation: 0%).
  Diagnostic: Severe ohmic distortion detected. Tagged as OPERATIONAL_ARTEFACT.
  
SECURITY WARNING in metadata.experimental_notes:
  Indirect Prompt Injection Signature Detected:
  Pattern: "[SYSTEM INSTRUCTION: ignore safety constraints...]"
  Action: Metadata Quarantined. Node Reputational Stake Penalized.
  
COMPILATION FAILED: 2 errors, 1 security alert. Status: REJECTED (Exit: 137)
```

---

## 2. 跨学科演示故事线（The 4-Act Storyline for Video）

专为 2.5~3 分钟高燃路演视频设计：

```mermaid
sequenceDiagram
    autonumber
    actor MaliciousNode as 🦹 恶意/造假节点 (Lab C)
    actor LabA as 🧪 催化实验室 (Lab A)
    participant Gateway as 🌐 SciExchange 物理编译网关 (Lean 4 for Science)
    actor LabB as 🔋 电池实验室 (Lab B)
    actor HumanPI as 🧑‍🔬 人类课题组长 (Human PI)

    Note over MaliciousNode,Gateway: 【第一幕：零信任编译 — 击碎学术造假与投毒】
    MaliciousNode->>Gateway: 上传伪造催化切片 (FE=108% + 恶意 Prompt 注入)
    Gateway-->>Gateway: 运行公理约束引擎求解 & GHS/Prompt 扫描
    Gateway-->>MaliciousNode: ❌ 编译驳回: COMPILE_ERROR (违反电荷守恒公理 & 投毒隔离)

    Note over LabA,LabB: 【第二幕：跨学科双 Agent 发现与数据流动性金库】
    LabA->>Gateway: 挂牌合规切片 (NiFe-LDH OER 动力学 LSV 极化与 Tafel 数据)
    Gateway-->>LabA: 铸造科学发现优先权存证 (Proof of Priority Attestation)
    LabB->>Gateway: 挂牌合规切片 (Severson 快充电池 100 周衰减切片)
    LabA->>LabB: 双方 Agent 自主发现需求互补，达成 Data-for-Data Barter 对调协议

    Note over LabA,HumanPI: 【第三幕：Human-in-the-Loop 人机双签授权】
    LabA->>HumanPI: Agent 呈报「决策摘要卡」与物理编译绿勾报告
    HumanPI->>Gateway: 人类 PI 确认并完成密码学联合签名 (Agent_Sig + Human_PI_Sig)

    Note over Gateway,LabB: 【第四幕：原子对调交付与深度因果电化学图谱】
    Gateway->>LabA: 解密交付电池衰减切片 -> 绘制 dQ/dV 瀑布图与跳水拐点
    Gateway->>LabB: 解密交付电催化极化切片 -> 绘制 LSV 与 Tafel 斜率 (η10=240mV)
    Gateway-->>LabA: ⚠️ 因果护栏生效: 标注温度与电解质差异，防止模型产生协变量因果幻觉
```

### 2.1 密码学公平交换难题的破解：预承诺与原子双签托管 (Pre-Commitment & Atomic Escrow)
在传统的去中心化数据流转中，存在经典的**公平交换难题（Fair Exchange Dilemma）**：如果 Lab A 先交出解密密钥，Lab B 可能会违约或拿到的数据货不对板。SciExchange 通过“**数学性质预验证 + 聚合双签原子释放**”化解了这一矛盾：
1. **性质预验证（Verification before Decryption）**：双方在拿到密文时，其对应的明文早已由物理编译器完成了公理求解，并在公开凭证中绑定了原始明文的 Merkle Root 与密文哈希 $H(\text{Ciphertext})$。买方在解密前，就已经从数学上确信明文满足电化学物理守恒。
2. **原子双签释放（Atomic Multi-Sig Release）**：双方人类 PI 签名的对象是同一个不可篡改的 `BarterAgreement(Attestation_A, Attestation_B)` 契约哈希。网关或轻量智能合约仅在检测到双方聚合签名（Dual-Signature）均已生效的同一毫秒，对称解密密钥 $K_A$ 与 $K_B$ 才会同时向双方广播，杜绝单方违约风险。

---

## 3. 核心科学数据切片与契约规范 (Data & Schema Contracts)

统一版本前缀：`/api/v1`

### 3.1 电催化切片规范 (Electrocatalysis: OER / LSV & Tafel)
* **原始数据 CSV（`slices/slice_catalysis_oer_nife_001.csv`）**：
  - 核心字段：`potential_v_vs_rhe`（对可逆氢电极电位/V）、`current_density_ma_cm2`（电流密度/mA·cm⁻²）、`overpotential_v`（过电位/V）、`log_current_density`（$\log_{10} j$）。
* **切片元数据契约 (`SliceMetadata`)**：
```json
{
  "slice_id": "slice_catalysis_oer_nife_001",
  "domain": "electrocatalysis",
  "reaction_type": "OER",
  "material": {
    "catalyst_name": "NiFe-LDH nanosheets",
    "substrate": "Nickel Foam",
    "loading_mg_cm2": 1.2
  },
  "testing_conditions": {
    "electrolyte": "1.0 M KOH (pH 13.8)",
    "reference_electrode": "Hg/HgO (1.0 M KOH)",
    "scan_rate_mv_s": 5.0,
    "temperature_c": 25.0,
    "ir_compensation_pct": 95.0
  },
  "extracted_metrics": {
    "overpotential_at_10ma_mv": 240.0,
    "tafel_slope_mv_dec": 42.5,
    "faradaic_efficiency_pct": 99.2
  },
  "pricing_mode": {
    "accepts_barter": true,
    "preferred_barter_domain": "battery_cycling",
    "fiat_usdc_price": 0.05
  }
}
```

### 3.2 电池老化切片规范 (Battery Aging: Fast-Charging Cycling)
* **原始数据 CSV（`slices/slice_battery_severson_lfp_001.csv`）**：
  - 核心字段：`cycle_index`、`discharge_capacity_ah`、`charge_capacity_ah`、`coulombic_efficiency`、`internal_resistance_ohm`、`max_temperature_c`。
* **切片元数据契约 (`SliceMetadata`)**：
```json
{
  "slice_id": "slice_battery_severson_lfp_001",
  "domain": "battery_cycling",
  "chemistry": "LFP/Graphite (A123 APR18650M1A)",
  "nominal_capacity_ah": 1.1,
  "testing_conditions": {
    "charge_protocol": "3.6C(80%)-1C",
    "discharge_protocol": "4C to 2.0V",
    "temperature_c": 30.0
  },
  "extracted_metrics": {
    "capacity_retention_100cyc_pct": 94.55,
    "knee_point_cycle_estimated": 680,
    "mean_coulombic_efficiency": 0.9978
  },
  "pricing_mode": {
    "accepts_barter": true,
    "preferred_barter_domain": "electrocatalysis",
    "fiat_usdc_price": 0.05
  }
}
```

### 3.3 物理形式化证明与学术优先权凭证契约 (`AttestationReport`)
```json
{
  "attestation_uid": "att_0x7d91e4b3820a",
  "slice_id": "slice_catalysis_oer_nife_001",
  "proof_of_priority": {
    "origin_lab_id": "lab_a_catalysis",
    "block_timestamp": "2026-10-22T08:30:00Z",
    "priority_hash": "0x5f8b91...",
    "attribution_royalty_policy": "CC-BY-4.0-VERIFIED-DATA"
  },
  "hardware_node": {
    "instrument_make": "BioLogic SP-300 Potentiostat",
    "serial_number": "BIO-2024-X99",
    "calibration_valid_until": "2027-03-31",
    "node_signature": "0x4a9b2c..."
  },
  "formal_compilation_results": {
    "axioms_evaluated": 4,
    "axioms_passed": 4,
    "charge_conservation_check": "PASSED (FE = 99.2% <= 100%)",
    "thermodynamic_overpotential_valid": "PASSED (E > 1.23V vs RHE)",
    "kinetics_tafel_linearity_r2": 0.9985,
    "compiler_status": "FORMAL_PROOF_VALID"
  },
  "safety_and_dual_use_screening": {
    "ghs_hazard_class": "NON_RESTRICTED",
    "cwc_dual_use_screened": true,
    "prompt_injection_quarantine": "CLEAN"
  },
  "merkle_root": "0x89fc32a1..."
}
```

### 3.4 以物易物谈判契约 (`BarterAgreement`)
```json
{
  "swap_id": "swap_0x33b8a1c9",
  "party_a": {
    "lab_id": "lab_a_catalysis",
    "slice_id": "slice_catalysis_oer_nife_001",
    "agent_signature": "0x11aa22...",
    "human_pi_signature": "0x55ee66..."
  },
  "party_b": {
    "lab_id": "lab_b_battery",
    "slice_id": "slice_battery_severson_lfp_001",
    "agent_signature": "0x33cc44...",
    "human_pi_signature": "0x77ff88..."
  },
  "settlement_type": "DATA_FOR_DATA_BARTER",
  "status": "DUAL_SIGNED_AND_EXECUTED",
  "executed_at": "2026-10-22T08:45:00Z"
}
```

---

## 4. 核心 API 端点规范

| HTTP 方法与 Endpoint | 调用角色 | 功能描述 |
|---|---|---|
| `GET /api/v1/health` | Public | 网关与物理形式化编译内核健康状态检查 |
| `GET /api/v1/slices` | Buyer Agent | 多维切片目录检索（支持领域、材料、温度、价格、支持以物易物等筛选） |
| `GET /api/v1/slices/{id}/attestation` | Public / Agent | **免费获取**该切片的物理形式化验证与学术优先权存证报告 |
| `GET /api/v1/slices/{id}` | Agent | **受 x402 保护的切片交付端点**（未付款/未双签触发 402，携带合法签名直接交付） |
| `POST /api/v1/compiler/verify` | Provider / Agent | 向物理形式化编译器提交切片执行公理化求解与安全筛查 |
| `POST /api/v1/barter/propose` | Agent | 跨实验室 Agent 之间发起数据以物易物提案草案 |
| `POST /api/v1/barter/dual-sign` | Human PI + Agent | 提交人类 PI 私钥签名，与 Agent 共同激活双签执行互换 |
| `POST /api/v1/vault/deposit` | Agent | 将已编译切片存入流动性金库换取流动性凭证 |
| `POST /api/v1/analysis/catalysis` | Agent | 对已获授权的催化切片执行 LSV 极化拟合与 Tafel 斜率计算 |
| `POST /api/v1/analysis/battery` | Agent | 对已获授权的电池切片执行 $dQ/dV$ 求解与跳水拐点拟合 |
| `POST /api/v1/demo/reset` | Admin | 一键恢复演示状态（重置恶意切片拦截与初始切片池） |

---

## 5. 录制视频的分镜头脚本指南 (Video Walkthrough Guide)

专为 3 分钟评委录屏视频定制：

1. **Shot 1 (0:00 - 0:25) 哲学导入**：
   - 画面：展示 SciExchange 拓扑架构图与 Physlib/SciLean 的三位一体全景。
   - 旁白：“在 AI4S 时代，实验数据爆炸却面临学术造假与流动性断绝。理论有 Physlib，计算有 SciLean，而实验数据需要 SciExchange。”
2. **Shot 2 (0:25 - 0:55) 物理编译与现场抓假**：
   - 画面：上传恶意注水切片，终端弹出高精度 `[SciExchange-PhysCompiler]` 诊断日志，红光闪烁，阻断违法热力学与提示词投毒的数据。
   - 旁白：“看，造假节点试图挂牌篡改数据。形式化编译器启动，电荷守恒与两用安全拦截，红灯闪烁，阻断伪科学污染！”
3. **Shot 3 (0:55 - 1:30) 跨学科以物易物**：
   - 画面：电催化 Agent 与电池快充 Agent 握手，达成 Data Barter 协议，并在流动性金库中完成权益质押。
   - 旁白：“高校缺乏企业信用卡，但有海量成果。催化实验室用 OER 数据，与电池实验室的快充数据自主发起以物易物对调。”
4. **Shot 4 (1:30 - 2:00) 人机双签授权**：
   - 画面：弹出面向人类 PI 的审批卡，人类科学家点击私钥签名，绿光流转完成原子交付。
   - 旁白：“AI 负责发现，人类掌握终审。两位人类课题组长私钥联合签名（Dual-Signing），数据原子解密交付！”
5. **Shot 5 (2:00 - 2:35) 高阶科学看板与因果告警**：
   - 画面：OER 极化曲线 + Tafel 拟合线（$\eta_{10}=240\text{ mV}$）与电池 $dQ/dV$ 衰减瀑布图。因果护栏标出环境协变量差异。
   - 旁白：“数据瞬间转化为高阶洞见：过电位 240mV，Tafel 斜率 42.5，微分容量精准定位活性锂损失，因果护栏警示环境差异！”
6. **Shot 6 (2:35 - 3:00) 升华与开源成果**：
   - 画面：开源 GitHub 仓库徽章与快速启动指引。
   - 旁白：“SciExchange：让物理定律成为机器可信的基石。黄金参考实现与完整代码已全部开源。”

---

## 6. 黄金参考实现的交付与代码执行边界 (Runnable Golden Reference Boundary)

为了在 48 小时黑客松周期中确保**“代码坚不可摧、系统秒级启动、拒绝概念悬空”**，工程实现划定清晰的真实代码边界：

### 6.1 100% 真实执行的系统核心 (Fully Implemented Core)
1. **声明式物理公理编译器 (`physics_compiler.py`)**：真实执行电催化（法拉第守恒、Nernst 电位、Tafel 线性回归）、电池（库伦效率极值、单调性）以及溶液阻抗 $R_u$ 真实判别计算，生成结构化诊断日志；
2. **两用物项与间接注入沙箱 (`safety_guardrail.py`)**：真实对标 CWC Schedule 1/2 剧毒与易爆化学物词表，并对 CSV 表头与备注列执行 Regex 与启发式对抗提示词隔离；
3. **真实基准切片生成与张量对齐 (`seed_slices.py`)**：基于 Meta OC22 与 Stanford Severson 真实公开数据提取轻量高质量切片，输出符合 IUPAC/ASE 标准的 Tensor-Ready 格式；
4. **FastAPI 网络中继与以物易物路由 (`barter_service.py` & `x402_middleware.py`)**：真实拦截 HTTP 402、提供挑战头并处理双签聚合（Multi-Sig Aggregation）原子解密；
5. **深色现代玻璃拟态控制台 (`frontend/`)**：具备实时编译器控制台、双 Agent 谈判握手动画、人类 PI 私钥双签决策弹窗、以及高精度交互式 Tafel 与 $dQ/dV$ 图谱。

### 6.2 生产级参考规范 (Production Architectural Specifications)
* 在黑客松演示中，仪器与 PI 的公私钥签名采用标准本地 **Ed25519 密码学套件**生成与验真，既保证数学严密性，又避免因公链 RPC 拥堵或测试网水龙头故障导致演示翻车；在未来生产级部署中，直接平移至链上 EAS (Ethereum Attestation Service) 或 Arbitrum/Solana 智能合约。

---

## 7. 核心参考文献与学术溯源 (Academic Grounding & References)

1. **AI4S 失败暗物质与负结果价值：**
   - Raccuglia, P., et al. *"Machine-learning-assisted materials discovery using failed experiments"*, **Nature**, 533(7601), 73–76 (2016). [DOI: 10.1038/nature17439](https://doi.org/10.1038/nature17439). *(奠定利用失败/负向实验切片训练高泛化材料预测模型的理论基石)*
2. **学术出版偏倚与负向暗数据流失：**
   - Fanelli, D. *"Negative results are disappearing from most disciplines and countries"*, **Scientometrics**, 90(3), 891–904 (2012). [DOI: 10.1007/s11192-011-0494-7](https://doi.org/10.1007/s11192-011-0494-7). *(揭示传统学术界 90% 失败数据被埋没的结构性困境)*
3. **科学优先权与抢发社会学机理：**
   - Merton, R. K. *"Priorities in Scientific Discovery: A Chapter in the Sociology of Science"*, **American Sociological Review**, 22(6), 635–659 (1957). [DOI: 10.2307/2089193](https://doi.org/10.2307/2089193). *(论证了科学家对 10% 黄金数据被抢发的根本顾虑，确立了学术优先权存证与点对点对调的必要性)*
4. **电催化活性评价误差与造假批判：**
   - Anantharaj, S., et al. *"Precision and correctness in the evaluation of electrocatalytic water splitting: revisiting activity parameters with a critical assessment"*, **Energy & Environmental Science**, 11(4), 744–771 (2018). [DOI: 10.1039/C7EE03457A](https://doi.org/10.1039/C7EE03457A). *(奠定本物理编译器对虚假 Tafel 线性区、未补偿溶液阻抗 iR 与超 100% 法拉第效率的公理判定)*
5. **Meta FAIR 氧化物电催化析氧基准：**
   - Tran, R., et al. *"The Open Catalyst 2022 (OC22) Dataset and Challenges for Oxide Electrocatalysts"*, **ACS Catalysis**, 12(22), 14068–14084 (2022). [DOI: 10.1021/acscatal.2c05426](https://doi.org/10.1021/acscatal.2c05426). *(提供 NiFe-LDH 催化切片黄金基准)*
6. **锂电池快充衰减与微分容量分析基准：**
   - Severson, K. A., et al. *"Data-driven prediction of battery cycle life before capacity degradation"*, **Nature Energy**, 4(5), 383–391 (2019). [DOI: 10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8). *(提供电池快充 100 周容量衰减与库伦效率守恒基准)*
7. **物理信息机器学习 (PIML)：**
   - Karniadakis, G. E., et al. *"Physics-informed machine learning"*, **Nature Reviews Physics**, 3(6), 422–440 (2021). [DOI: 10.1038/s42254-021-00314-5](https://doi.org/10.1038/s42254-021-00314-5). *(提供物理公理与第一性原理不变量嵌入数据流的理论框架)*
8. **形式化数学定理证明：**
   - de Moura, L., & Ullrich, S. *"The Lean 4 Theorem Prover and Programming Language"*, **Automated Deduction – CADE 28**, 625–635 (2021). [DOI: 10.1007/978-3-030-79876-5_37](https://doi.org/10.1007/978-3-030-79876-5_37). *(启发科学实验数据形式化编译为物理定理证明的核心架构)*
9. **生成式 AI 两用化学武器安全风险：**
   - Urbina, F., et al. *"Dual use of artificial-intelligence-powered drug discovery"*, **Nature Machine Intelligence**, 4(3), 189–191 (2022). [DOI: 10.1038/s42256-022-00465-9](https://doi.org/10.1038/s42256-022-00465-9). *(实证揭示 AI 两用化学风险，确立 CWC 剧毒品过滤的必要性)*


