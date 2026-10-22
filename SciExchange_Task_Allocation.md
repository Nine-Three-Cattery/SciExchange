# SciExchange — 三人小组敏捷分工与落地指南 (Team Collaboration Guide)

**文档版本：** v4.0（完整工业级参考实现与视频路演版）  
**适用赛会：** Open Scientific Intelligence (OSI) Hackathon 2026  
**对应白皮书：** `SciExchange — 项目系统设计白皮书与技术规范` v4.0  
**核心开发法则：** **一个文件只设一名 Owner；接口先冻结，再并行开发；物理守恒为核，人机双签为纲。**

---

## 1. 角色分工与交付成果概览

| 成员 | 角色定位 | 核心使命 | 核心交付成果 (Deliverables) |
|---|---|---|---|
| **A** | **网络网关、x402、数据金库与以物易物清算**<br>*(Platform & Settlement Core)* | 构建极简的去中心化网络中间件，支撑 HTTP 402 微支付、数据流动性金库（Data Vault）、以物易物原子互换与双签验证 | • FastAPI 统一入口与 x402 中间件（HTTP 402 拦截与签名校验）<br>• `barter_service.py`：双 Agent 谈判撮合与人类 PI 双签（Dual-Signing）核验<br>• `vault_service.py`：切片流动性金库（解决以物易物双重巧合难题）<br>• 学术优先权存证（Proof of Priority）上架签发引擎<br>• `seed_slices.py`、`reset_demo.py`、`API_CONTRACTS.md` |
| **B** | **物理形式化编译、化学安全与科学智能**<br>*(Physics Compiler & Scientific Intelligence)* | 打造“科学界的 Lean 4 编译核”，提供公理化守恒求解、两用安全阻断与催化/电池深度分析 | • 电催化（Meta FAIR OC22 级 OER/Tafel）与电池（Stanford/MIT Severson 快充）黄金基准切片准备<br>• `physics_compiler.py`：公理化约束求解核（电荷守恒 FE≤100%、热力学过电位与阿伦尼乌斯拟合校验）<br>• `safety_guardrail.py`：GHS 危险化学品筛查与间接提示词注入（Indirect Prompt Injection）检测<br>• `domain_analytics.py`：电催化 LSV/Tafel 计算与电池 $dQ/dV$ 拐点拟合引擎 |
| **C** | **前端交互、双签可视化与夺冠视频录屏**<br>*(Experience, Dual-Sig UI & Video Production)* | 打造极具视觉冲击力的现代深色科技感 UI，掌控 3 分钟录屏分镜与终审交付 | • React + Vite + TS 现代深色玻璃拟态界面（Dark Glassmorphism）<br>• **Lean 4 for Science 编译面板**：实时展示造假切片被物理定律红灯驳回与诊断日志<br>• **A2A 谈判与以物易物交互卡**：展示双 Agent 达成交换协议的流动效果<br>• **Human PI 双签弹窗**：人类课题组长点击私钥签名完成原子对调<br>• **双学科专业科学图谱**：电催化 Tafel 拟合线与电池 $dQ/dV$ 衰减瀑布图<br>• **录屏与分镜总控**：按 6 大镜头录制 3 分钟 1080P/2K 演示视频与配音旁白 |

---

## 2. 仓库架构与文件所有权（Ownership Matrix）

```text
sciexchange/
├── README.md                            # C 拥有：项目前沿亮点、架构图谱与启动指南
├── docs/
│   ├── HANDOVER.md                      # 全体基线：系统设计白皮书与技术规范
│   ├── TEAM_WORKSPLIT.md                # 本文件：分工契约
│   ├── API_CONTRACTS.md                 # A 拥有：x402、切片与以物易物接口规范
│   ├── PHYSICS_RULES.md                 # B 拥有：电催化与电池物理不变量公理集
│   └── DEMO_SCRIPT.md                   # C 拥有：3 分钟视频分镜头脚本与逐字稿
├── backend/
│   ├── app/
│   │   ├── main.py                      # A 拥有：FastAPI 唯一入口与路由挂载
│   │   ├── core/                        # A 拥有：配置、x402 拦截中间件
│   │   │   ├── config.py
│   │   │   └── x402_middleware.py
│   │   ├── models/schemas.py            # A 唯一维护：切片、凭证、以物易物 Pydantic 规范
│   │   ├── api/
│   │   │   ├── slices.py                # A 拥有：切片目录与受控交付
│   │   │   ├── barter.py                # A 拥有：以物易物提案与双签激活端点
│   │   │   ├── vault.py                 # A 拥有：流动性金库质押与 SciCredit 申领
│   │   │   ├── compiler.py              # B 拥有：物理形式化编译与防伪校验接口
│   │   │   └── analysis.py              # B 拥有：催化 Tafel 与电池 dQ/dV 分析接口
│   │   ├── services/
│   │   │   ├── barter_service.py        # A 拥有：谈判对调与双签密码学验证
│   │   │   ├── vault_service.py         # A 拥有：数据流动性金库池管理
│   │   │   ├── physics_compiler.py      # B 核心：声明式公理约束求解器
│   │   │   ├── safety_guardrail.py      # B 核心：两用化学品与间接 Prompt 注入沙箱
│   │   │   └── domain_analytics.py      # B 核心：高斯微分求导与动力学特征拟合
│   │   └── agent/                       # B 拥有：Agent 意图解析、供需匹配逻辑
│   ├── scripts/
│   │   ├── seed_slices.py               # A + B：灌入三份切片（催化真实、电池真实、造假切片）
│   │   └── reset_demo.py                # A 拥有：一键重置演示状态
│   └── tests/
├── data/
│   ├── slices/                          # B 拥有：准备催化与电池黄金基准切片
│   │   ├── slice_catalysis_oer_nife_001.csv
│   │   ├── slice_battery_severson_lfp_001.csv
│   │   └── slice_fraud_fake_oer_002.csv # 包含 FE=108% 与 Prompt 注入的负例
├── frontend/                            # C 独占
│   └── src/
│       ├── components/
│       │   ├── PhysicsCompilerConsole.tsx # C: 物理形式化编译终端（红绿诊断日志）
│       │   ├── BarterNegotiationCard.tsx  # C: 双 Agent 以物易物谈判卡与金库池
│       │   ├── HumanDualSignModal.tsx     # C: 人类 PI 私钥双签决策面板
│       │   ├── AttestationDagGraph.tsx    # C: Lean Atlas 风格凭证追溯依赖图
│       │   └── DualDomainAnalytics.tsx    # C: 催化 Tafel 拟合与电池 dQ/dV 双视窗
│       └── pages/Dashboard.tsx
└── e2e/                                 # C 拥有：跨模块集成测试
```

---

## 3. 并行攻坚顺序与测试矩阵

### 3.1 敏捷开发时间表 (48 小时冲刺)

| 时间窗口 | 成员 A (平台/交换/清算) | 成员 B (物理编译/科学大脑) | 成员 C (界面/双签交互/录屏) | 里程碑产出 |
|---|---|---|---|---|
| **T0–3h** | 初始化 Repo，编写共享 Schema，定义并冻结 `API_CONTRACTS.md` | 准备 3 份切片 CSV（催化、电池、造假负例），确定物理不变量边界 | 初始化 React + Tailwind，设计深色科技感 Layout，建立 Mock 响应 | 接口完全冻结，三人均可本地独立启动 |
| **T3–12h** | 实现 x402 拦截、切片受控交付与以物易物双签验证服务 | 编写声明式物理编译器（公理化求解）及两用物项/Prompt 安全过滤 | 制作「物理编译器控制台」与「以物易物与金库组件」 | 单体功能通过，负例能被编译器红灯精准拦截 |
| **T12–24h** | 联调 `/barter` 与 `/vault` 端点，全流程数据加密解密释放 | 联调催化 LSV/Tafel 与电池 $dQ/dV$ 分析端点，接入因果告警 | 接入真实后端，完成人类 PI 双签弹窗与专业图表渲染 | Happy Path 与造假拦截在 Web 端端跑通 |
| **T24–36h** | 完善 `reset_demo.py`，确保一键恢复演示环境 | 优化拟合平滑算法，补充科学解释文案 | 彩排录制视频，打磨 6 大分镜、配音与中英字幕，渲染终稿视频 | 终审提交材料（代码、文档、视频）全量就绪 |

### 3.2 验收与测试矩阵 (Test Matrix)

| 测试案例 | A | B | C | 预期结果 |
|---|---|---|---|---|
| **造假切片上架** | 接收数据 | **公理化编译器求解** | 控制台渲染 | 捕获 $FE > 100\%$，输出多行物理公理违例日志，禁止挂牌 |
| **Prompt 注入攻击** | 传递元数据 | **安全守门人检测** | 告警徽标 | 隔离恶意指令，避免下游 Agent 执行被诱导指令 |
| **学术优先权存证** | **铸造优先权时间戳** | 验证元数据完整性 | 凭证展示 | 成功签发带时间戳与署名政策的 Attestation UID |
| **双 Agent 意图匹配** | 撮合服务 | 意图与供需提取 | 状态反馈 | 自动识别催化与电池需求互补，生成以物易物提案草案 |
| **以物易物双签机制** | **核验双签私钥** | 参与数据打包 | **人类 PI 交互签名** | 单方签名无法释放数据；双签完成后两份数据切片原子解密交付 |
| **电催化与电池图谱** | 交付数据流 | **特征计算** | **交互式渲染** | 呈现高精度 Tafel 斜率（42.5 mV/dec）与电池 $dQ/dV$ 拐点 |
