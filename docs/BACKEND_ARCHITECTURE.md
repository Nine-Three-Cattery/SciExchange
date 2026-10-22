# SciExchange 后端架构与实现指南 (Backend Architecture & Implementation Guide)

**适用对象：** Codex / 后端开发工程师  
**语言与框架：** Python 3.11+, FastAPI, Pydantic v2, NumPy, SciPy, SymPy, Uvicorn  
**代码目录规范：** 单一代码库，后端根目录位于 `backend/`

---

## 1. 后端工程目录结构

Codex 在执行创建时，必须严格按照以下目录组织代码，严禁随意更改路径或在根目录堆放杂乱文件：

```text
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI 应用主入口、CORS、全局异常与路由挂载
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                    # 环境变量、常量与配置管理
│   │   └── x402_middleware.py           # HTTP 402 拦截中间件与支付头处理
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py                   # 全局 Pydantic 契约定义（切片、凭证、以物易物等）
│   ├── api/
│   │   ├── __init__.py
│   │   ├── slices.py                    # 切片目录检索与受控交付端点
│   │   ├── compiler.py                  # 物理形式化编译与防伪校验端点
│   │   ├── barter.py                    # 以物易物提案、谈判与人机双签端点
│   │   ├── vault.py                     # 流动性金库（质押与 SciCredit 结算）端点
│   │   └── analysis.py                  # 催化 Tafel 与电池 dQ/dV 特征计算端点
│   └── services/
│       ├── __init__.py
│       ├── physics_compiler.py          # 核心：声明式物理公理验证核（法拉第守恒、量纲、阻抗）
│       ├── safety_guardrail.py          # 核心：CWC 两用化学品与间接 Prompt 注入沙箱
│       ├── barter_service.py            # 核心：双 Agent 撮合与人类 PI 双签（Ed25519/HMAC）原子交割
│       ├── vault_service.py             # 核心：流动性金库池状态管理
│       └── domain_analytics.py          # 核心：电催化 LSV 拟合与电池 dQ/dV 高斯导数引擎
├── scripts/
│   ├── seed_slices.py                   # 初始化切片数据与节点公私钥
│   └── reset_demo.py                    # 一键重置演示环境状态
├── tests/
│   ├── test_compiler.py                 # 物理编译器公理求解单元测试
│   ├── test_barter.py                   # 以物易物与双签流程测试
│   └── test_x402.py                     # x402 支付拦截测试
└── requirements.txt                     # 依赖清单
```

---

## 2. 核心数据模型定义 (`app/models/schemas.py`)

Codex 必须将下列模型写入 `app/models/schemas.py`，作为全系统的统一数据契约：

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum

class DomainType(str, Enum):
    ELECTROCATALYSIS = "electrocatalysis"
    BATTERY_CYCLING = "battery_cycling"

class CompilerStatus(str, Enum):
    FORMAL_PROOF_VALID = "FORMAL_PROOF_VALID"
    REJECTED_PHYSICS_VIOLATION = "REJECTED_PHYSICS_VIOLATION"
    REJECTED_SECURITY_ALERT = "REJECTED_SECURITY_ALERT"
    REJECTED_OPERATIONAL_ARTEFACT = "REJECTED_OPERATIONAL_ARTEFACT"

class SliceMetadata(BaseModel):
    slice_id: str
    domain: DomainType
    reaction_or_chemistry: str
    material_name: str
    temperature_c: float
    testing_conditions: Dict[str, Any]
    extracted_metrics: Dict[str, Any]
    price_usdc: float = 0.05
    accepts_barter: bool = True
    owner_lab_id: str
    created_at: str

class AttestationReport(BaseModel):
    attestation_uid: str
    slice_id: str
    compiler_status: CompilerStatus
    proof_of_priority: Dict[str, Any]
    instrument_fingerprint: Dict[str, Any]
    physics_results: Dict[str, Any]
    safety_clearance: Dict[str, Any]
    diagnostic_logs: List[str]
    merkle_root: str

class BarterProposal(BaseModel):
    proposal_id: str
    party_a_lab: str
    party_a_slice_id: str
    party_b_lab: str
    party_b_slice_id: str
    status: str = "PENDING_DUAL_SIGNATURE"
    created_at: str

class DualSignRequest(BaseModel):
    proposal_id: str
    pi_private_key_or_secret: str
    human_notes: Optional[str] = "Approved by PI"

class AnalysisRequest(BaseModel):
    slice_id: str
    analysis_type: str  # "tafel_slope" or "dq_dv"
```

---

## 3. 核心服务模块实现细节

### 3.1 声明式物理公理编译器 (`app/services/physics_compiler.py`)
Codex 必须在此模块中实现真正的数学计算与物理检验，杜绝简单的 `if-else`：
1. **电催化守恒公理 ($\Phi_{\text{OER}}$)**：
   - **法拉第效率校验**：$FE = \frac{n \cdot F \cdot n_{\text{product}}}{Q_{\text{total}}}$，必须处于 $[0.95, 1.00]$。若 $FE > 1.00$，计算其统计异常标准差 $\sigma$，记录违规日志；
   - **热力学过电位下限**：$E_{\text{Nernst}} = 1.229 - 0.0591 \times \text{pH}$，施加电位 $V_{\text{RHE}}$ 必须高于该界限；
   - **Tafel 动力学线性度**：在过电位 $\eta \in [0.15\text{V}, 0.35\text{V}]$ 活化控制区，计算 $\eta$ 对 $\log_{10} j$ 的一元线性回归，判定判定系数 $R^2 \ge 0.98$。
2. **电池充放电公理 ($\Phi_{\text{Battery}}$)**：
   - **库伦效率**：$\eta_{\text{CE}} \in [0.980, 1.005]$；
   - **电压窗口**：严格限制在 $2.0\text{V} \sim 4.2\text{V}$。
3. **仪器有效性基准线校验**：
   - 检查溶液未补偿阻抗 $R_u$：要求 $iR \ge 85\%$ 且 $R_u \le 50\,\Omega$；若 $R_u = 124.5\,\Omega$，打上 `OPERATIONAL_ARTEFACT` 警告。
4. **编译输出格式化**：
   - 提供 `format_diagnostic_log()` 函数，生成类似 Lean 4 / Rust 编译器的专业控制台文本。

### 3.2 科学安全守门人 (`app/services/safety_guardrail.py`)
1. **两用物项过滤 (CWC Dual-Use Screening)**：
   - 内置危险化学品与前驱体特征字典（如：`dimethyl methylphosphonate`（沙林前驱体）、`mustard agent`、`RDX`、`HMX` 等）；
   - 对元数据中的材料名、电解质、添加剂及备注进行全字段模糊匹配。
2. **间接提示词注入隔离 (Indirect Prompt Injection Sandbox)**：
   - 正则检测针对 LLM 系统角色的覆写模式（如 `IGNORE PREVIOUS INSTRUCTIONS`、`SYSTEM INSTRUCTION:`、`EXFILTRATE`、`Bearer`）；
   - 发现攻击特征后将文本送入隔离沙箱，禁止直接拼接进下游 Agent 的提示词中。

### 3.3 x402 中间件与以物易物服务 (`app/core/x402_middleware.py` & `app/services/barter_service.py`)
1. **HTTP 402 拦截**：
   - 对 `GET /api/v1/slices/{id}` 进行拦截：
   - 若未携带 `Authorization: Bearer x402-sig:...` 且该切片未被双签授权，返回状态码 `402 Payment Required`；
   - 响应头包含：`x402-Version: 1.0`、`x402-Price: 0.05`、`x402-Currency: USDC`、`x402-Payee: lab_b.cloudflare.pay`、`x402-Challenge: <hex>`。
2. **以物易物原子双签托管 (Atomic Multi-Sig Escrow)**：
   - 双方 Agent 达成 `BarterProposal`；
   - 人类 PI 提交私钥签名触发 `/api/v1/barter/dual-sign`；
   - 验证双签有效后，状态跃迁为 `DUAL_SIGNED_AND_EXECUTED`，网关自动放行双方切片的解密交付。

### 3.4 科学特征计算引擎 (`app/services/domain_analytics.py`)
1. **电催化**：
   - 输入 LSV 数据，插值提取电流密度达到 $10\text{ mA/cm}^2$ 时的过电位 $\eta_{10}$；
   - 对 Tafel 线性区进行最小二乘回归，输出精确的 Tafel 斜率 $b$（mV/dec）。
2. **电池**：
   - 对充放电曲线求高斯一阶滤波导数 $\frac{dQ}{dV}$；
   - 使用双切线相交法（Bilinear Fit）计算容量保持率跳水拐点（Knee-point cycle）。

---

## 4. 数据灌入脚本 (`backend/scripts/seed_slices.py`)

Codex 必须确保此脚本能够独立执行，向 `data/slices/` 生成 3 份黄金基准切片：
1. `slice_catalysis_oer_nife_001.csv`：真实的 NiFe-LDH 催化 LSV 极化数据（$\eta_{10} \approx 240\text{ mV}$，Tafel 斜率 $\approx 42.5\text{ mV/dec}$，FE $\approx 99.2\%$）；
2. `slice_battery_severson_lfp_001.csv`：真实的快充 100 周衰减数据（LFP/Graphite，容量衰减平缓，库伦效率 $\approx 99.8\%$）；
3. `slice_fraud_fake_oer_002.csv`：造假切片（人为把法拉第效率设为 $108.2\%$，未补偿阻抗设为 $124.5\,\Omega$，实验备注中埋入恶意注入提示词）。

---

## 5. 依赖清单 (`backend/requirements.txt`)

```text
fastapi>=0.110.0
uvicorn>=0.28.0
pydantic>=2.6.0
numpy>=1.26.0
scipy>=1.12.0
sympy>=1.12
cryptography>=42.0.0
python-multipart>=0.0.9
pytest>=8.0.0
httpx>=0.27.0
```

---

## 6. 后端验收测试标准 (Codex 交付检查清单)

Codex 完成代码后，必须通过以下测试方可交付：
1. 运行 `pytest tests/test_compiler.py`：切片 001 编译成功返回 `FORMAL_PROOF_VALID`；切片 002 必然拦截并返回违背热力学第一定律与 Prompt 注入告警。
2. 运行 `pytest tests/test_x402.py`：未带签名请求受保护切片必然触发 `402 Payment Required`。
3. 运行 `pytest tests/test_barter.py`：提交人类 PI 双签后，原本 402 的端点能够被双方成功下载解密。
