# SciExchange — 三人小组开发分工与协作说明

**文档版本：** v1.0（2026-10-21）  
**适用场景：** 3 人 Hackathon 团队，面向人类开发者及 AI Coding Agent。  
**依据文档：** `SciExchange — 项目交接文档（Handover Note）` 中文版 v1.0。  
**项目状态：** *开发计划，而非已完成的实现。* 成员姓名、实际仓库路径和进度须在 Kickoff 后填写。  
**项目目标：** 完成“数据发现 → Agent 规划 → 后端报价 → 模拟购买 → 数据授权与完整性检查 → 科学分析与展示”的可复现 Demo。

> **最重要的协作原则：一个文件只设一名主要负责人；先冻结接口，再并行开发。** 不以“谁先写完”作为修改其他人文件的理由。

---

## 1. 一页概览：三个人分别做什么

| 成员 | 角色 | 一句话职责 | 主要交付成果 |
|---|---|---|---|
| **A** | **平台与交易后端（Platform & Trust）** | 搭建唯一可信的数据库、接口、授权和模拟交易核心 | 数据库、Catalog、Quote、Purchase、Wallet、Grant、Hash/Audit、Seed/Reset |
| **B** | **AI Agent 与科学分析（Scientific Intelligence）** | 让系统正确理解科研需求、选择数据并生成可信的分析结果 | 合成实验数据、`/agent/plan`、科学匹配与警告、`/analysis/battery-aging` |
| **C** | **前端、Demo 与端到端集成（Experience & QA）** | 将 A/B 的能力组装为一条评委看得懂、能操作、可回放的用户旅程 | React 页面、API Client、Mock 响应、图表、E2E 测试、Demo 脚本与 README |

**建议成员分配：** A 适合熟悉 Python/FastAPI/SQL 的人；B 适合熟悉 LLM/Tool Calling/Pandas 的人；C 适合熟悉 React/TypeScript/可视化的人。若技能分布不同，可以交换人选，但**不要拆散上述模块的归属**。

**为什么这样分：** A 负责所有会改变系统状态或决定授权的行为；B 负责 AI 和科学逻辑，尽量做无副作用的计算；C 负责用户体验和跨模块验收。三人的代码边界清晰，合并时主要通过固定 API 对接。

---

## 2. 必须保持一致的 MVP 范围

1. **3 个模拟 Lab**、**至少 6 个合成 Battery Aging Dataset**，而不连接真实自动化实验室。
2. 公开查询**可分享的元数据**；未购买或无权限时不得下载原始 CSV。
3. 用户给出研究需求及 `max_budget_credits`。Agent 仅返回建议，不自动扣费。
4. 后端对所选 Dataset 重新检查许可、报价、余额、预算和购买确认，然后使用 **Demo Credits** 原子化模拟扣款。
5. 购买生成 Receipt + Access Grant；下载前后端核验 SHA-256，并写入 Audit Event。
6. 展示 25°C vs 40°C 电池容量衰减曲线，明确标出来源、单位、合成数据及科学可比性限制。
7. 至少演示一次未授权/超预算拒绝，以及一次数据篡改检测；可以重置数据重复 Demo。

**不做：** 真实实验室接入、真实加密货币支付、区块链、联邦学习、生产级账户系统。Telegram/WhatsApp、MCP/x402、复杂 Provider UI 均为可选项，不能影响 P0。

---

## 3. 仓库目录与文件所有权（最关键）

统一保持单仓库（Monorepo），但按**目录/文件级所有权**分工。以下为建议结构，先由 A 建立空目录，随后各自只改自己拥有的文件。

```text
sciexchange/
├── README.md                            # C
├── .env.example                         # A
├── docs/
│   ├── HANDOVER.md                      # 只读基线，所有人不得随意改
│   ├── TEAM_3_WORKSPLIT.md              # 本文件；改动须三人同意
│   ├── API_CONTRACTS.md                 # A 唯一维护，三人共同评审
│   ├── SCIENTIFIC_RULES.md              # B
│   └── DEMO_SCRIPT.md                   # C
├── backend/
│   ├── app/
│   │   ├── main.py                      # A 唯一维护路由注册
│   │   ├── core/{config,auth,db}.py     # A
│   │   ├── models/{db_models,schemas}.py# A；共享 Schema 禁止旁人直接改
│   │   ├── api/
│   │   │   ├── labs.py                   # A
│   │   │   ├── datasets.py               # A
│   │   │   ├── quotes.py                 # A
│   │   │   ├── purchases.py              # A
│   │   │   ├── audit.py                  # A
│   │   │   ├── agent.py                  # B
│   │   │   └── analysis.py               # B
│   │   ├── services/
│   │   │   ├── catalog.py                # A
│   │   │   ├── policy.py                 # A
│   │   │   ├── payment.py                # A
│   │   │   ├── integrity.py              # A
│   │   │   ├── delivery.py               # A
│   │   │   ├── audit.py                  # A
│   │   │   ├── ranking.py                # B
│   │   │   └── analysis.py               # B
│   │   └── agent/{planner,tools,prompts}.py  # B
│   ├── scripts/
│   │   ├── seed_demo.py                  # A，读取 B 的数据文件
│   │   ├── reset_demo.py                 # A
│   │   └── generate_synthetic.py         # B
│   ├── tests/
│   │   ├── core/                        # A
│   │   └── science/                     # B
│   ├── requirements_core.txt            # A
│   └── requirements_science.txt         # B
├── data/
│   ├── synthetic/                       # B；至少 6 份 CSV 与元数据 JSON
│   └── uploads/                         # A 运行时目录；不提交真实文件
├── frontend/                             # C 独占（包括 package*.json）
│   └── src/{pages,components,lib}/
└── e2e/                                  # C；跨模块黑盒测试
```

**所有权规则：**
- **A** 负责共享后端基础设施和 `main.py`；需要挂载 B 的两个 Router 时，由 **A** 执行 import/include_router，不让 B 改 `main.py`。
- **B** 只能调用 A 提供的 Catalog/Delivery 接口，**不直接读取数据库表或私有 CSV 路径**，不修改支付、授权、订单表。
- **C** 不修改 Backend；通过 `/api/v1/*` API 对接。前端需求若需新接口，先提出契约变更。
- 每人只格式化自己负责的文件，不能运行会自动改写全仓库的格式化命令。
- 若未来添加新文件，放在所属目录；归属不明时先发消息确认 Ownership。

> **例外：** 任何人发现其他模块的 Bug，可以提交 Issue/重现步骤或在 PR 评论建议，但默认由该模块 Owner 修改。如果紧急跨界修复，必须得到 Owner 明确同意，并由 Owner Review。

---

## 4. 三名成员的任务与验收要求

### 成员 A — 平台与交易后端

**负责开发：**
1. FastAPI 项目启动、SQLite + SQLAlchemy、统一 `/api/v1` 路由和 Swagger 文档。
2. 根据 Handover Schema 定义 `labs`, `datasets`, `wallets`, `purchase_orders`, `order_items`, `access_grants`, `audit_events`。
3. 从 `data/synthetic/` 导入 B 的 6+ 数据集，生成 3 个 Mock Labs 和可重复的初始钱包余额。
4. Catalog：只输出允许查询的元数据，提供 `GET /labs`, `GET /datasets`, `GET /datasets/{id}`。
5. Quote/Checkout：`POST /quotes`, `POST /purchases`, `GET /purchases/{id}`, `GET /wallet`；由后端计算真实价格和检查授权、余额、预算、幂等键。
6. 访问控制、已购文件下载、SHA-256 校验、结构化 Audit Event；提供 `POST /demo/reset`，仅限本地 Admin。
7. 向 B 提供稳定的内部只读服务：`CatalogService.search(filters, buyer)`，`DeliveryService.get_verified_dataset(dataset_id, buyer)`，具体返回类型以 `API_CONTRACTS.md` 为准。
8. 在 `main.py` 中注册 B 提供的 `agent` 与 `analysis` Routers。

**对外接口：** `/labs`、`/datasets`、`/quotes`、`/purchases`、`/wallet`、`/audit-events`、`/demo/reset`、`/datasets/{id}/download`。

**验收：** 使用 curl/Swagger，即使没有 Agent 和 Frontend 也能：查到数据 → 报价 7 Credits → 确认购买 → 余额正确扣减一次 → 获取已购数据 → 重置；无权限、超预算、重复购买、篡改文件必须按约束处理。

**边界：** 不负责 Prompt、科学排名策略、图表/UI，也不修改 `data/synthetic/`。

### 成员 B — Agent、科学数据与分析

**负责开发：**
1. 在 `data/synthetic/` 生成 **至少 6 份**结构一致的 Battery Aging CSV + JSON Metadata：明确标注 `synthetic`、温度、C-rate、电芯条件、单位、许可和价格。
2. 固定 Demo 的两条核心 Dataset：`ds_lab_a_25c_001`（3 Credits）与 `ds_lab_b_40c_001`（4 Credits）；另外准备匹配较差/禁售/较贵的候选作为负例。
3. 编写科学数据字段检查与可比性规则：单位、缺失字段、实验类型、化学体系、C-rate 等；输出**警告**，避免把相关性说成因果性。
4. 实现 `POST /agent/plan`：自然语言解析 → 类型化 SearchIntent → 调用 A 的目录接口 → 可解释排名 → 推荐组合；仅**建议** Dataset ID 和估计费用，**绝不执行实际购买**。
5. 实现 LLM 失败后的 Rule-based Parser，确保 Demo 可离线/弱网络演示。
6. 实现 `POST /analysis/battery-aging`：仅使用 A 的 `DeliveryService` 已验证、已授权返回的数据，计算容量保持率并返回图表数据、来源及科学限制。
7. 提交对应 pytest、`docs/SCIENTIFIC_RULES.md` 和至少 10 个小型查询/条件测试样例。

**对外接口：** `/agent/plan`、`/analysis/battery-aging`。B 负责两个路由文件，A 负责统一注册。

**验收：** 输入 Demo 查询、预算 10 Credits，返回 25°C/40°C 两份 Dataset、估算 7 Credits、合理的可比性警告；Agent 不能修改钱包；未获授权的分析请求必须被 A 的 Delivery 服务拒绝。

**边界：** 不修改数据库 Schema、支付/授权逻辑、前端或 `main.py`。不靠 LLM 自行决定真实价格或访问权限。

### 成员 C — 前端、展示及端到端 QA

**负责开发：**
1. 创建 React + Vite + TypeScript 前端，至少包含：研究请求页、候选数据集展示、购买确认、交易结果、图表、审计/错误展示。
2. 开发统一的 TypeScript API Client 与 Types：字段名称从已冻结的 `docs/API_CONTRACTS.md` 获取；所有请求集中在 `frontend/src/lib/api.ts` 或模块化同一子目录。
3. 在 Backend 未完成前建立 `frontend/src/mocks/` 假响应，以同一 JSON 契约先做 UI；集成后切换到真实 API，不维护第二套字段命名。
4. 实现 `ExperimentChart`，显示 25°C 与 40°C 曲线、循环次数、容量保持率单位、来源与限制；明确显示 `Synthetic Data`、`Simulated Payment`。
5. 实现 Quote Review：展示 Server-side 权威报价并取得用户确认，才发送 `POST /purchases`；使用稳定 Idempotency Key 防止重复提交。
6. 编写 `e2e/` 测试与 `docs/DEMO_SCRIPT.md`、`README.md`；统一启动/重置步骤，安排最终演示录像或展示流程。
7. 最后负责串起 Demo，但**不自行修补 A/B 后端内部文件**；将问题定位后交给相应 Owner 处理。

**验收：** 在不查看代码的情况下，另一位成员能根据 README 启动系统，打开页面完成 25°C/40°C 购买和分析；面对超预算/禁止购买/校验失败，UI 能明确反馈而非卡死。

**边界：** 不碰 Backend、Schema、支付实现、科学计算实现；不能前端本地模拟“购买成功”并当作真实后端结果。

---

## 5. Kickoff 前 60–90 分钟必须先完成的契约冻结

**团队共同讨论，但由 A 写入 `docs/API_CONTRACTS.md`。** 三人都确认后开始并行开发。最少确认：

| 对象/接口 | 固定的关键字段或约定 | Owner |
|---|---|---|
| `DatasetSummary` | `dataset_id`, `version`, `lab_id`, `title`, `conditions`, `measurements`, `access`, `price_credits`, `quality` | A 定义，B/C 使用 |
| `SearchIntent` | `domain`, `experiment_type`, `requested_temperatures_c`, `required_measurements` | A 定义，B 填充 |
| `POST /agent/plan` | 请求：`query`, `max_budget_credits`, `allowed_uses`, `purchase_mode`；响应：`intent`, `candidate_dataset_ids`, `proposed_dataset_ids`, `estimated_total_credits`, `comparability_warnings`, `requires_confirmation` | B 实现 |
| `POST /quotes` | 输入 Dataset IDs + Budget；响应：`quote_id`, `eligible_items`, `ineligible_items`, `total_credits`, `status` | A 实现 |
| `POST /purchases` | Header: `Idempotency-Key`；Body: `quote_id`, `max_budget_credits`, `confirm`；返回订单 ID、Receipt、Grant 摘要 | A 实现 |
| `POST /analysis/battery-aging` | 输入：`dataset_ids`；输出：每个 Dataset 的 `cycle_index`, `capacity_retention_pct` 序列、单位、来源、warnings | B 实现 |
| 统一报错 | `{"error":{"code":"BUDGET_EXCEEDED","message":"..."}}` | A 定义；B/C 遵守 |
| 身份、域名与 CORS | 本地预置 Buyer 身份；Server 判定权限；Frontend 不直接传可冒充的 `buyer_id` | A 定义；C 调用 |

**需要特别约定：** `GET /datasets` 在未购买时只能返回公开的 Metadata，不返回 CSV；`POST /agent/plan` 只规划不付费；`POST /analysis/battery-aging` 只能访问已授权数据；所有订单金额以 A 的 Quote 为准。

**共享服务（A → B）的最小适配约定：** B 只依赖 A 已公开的 `CatalogService.search(...)` 与 `DeliveryService.get_verified_dataset(...)`（或统一定义的 Gateway Interface）。在 A 的实现未完成前，B 使用同一输入/输出的数据 Fixture，不自行操作 A 的 DB 层。

**冻结后的修改流程：** 提出变更 → 告知 A/B/C → 说明影响和新 JSON 示例 → 三人确认 → A 更新 `API_CONTRACTS.md` 与 Schema → A/B/C 分别修改自己负责模块。**不允许单方面更改字段名、Endpoint、枚举、数据单位。**

---

## 6. 如何真正并行开发：时间与集成顺序

| 阶段 | A：平台 | B：科学 AI | C：UI / 集成 | 必须产出的结果 |
|---|---|---|---|---|
| **T0–2h** | 初始化 Repo、Schema、API 契约和空 Router | 生成 25°C/40°C 示例 CSV、规划 SearchIntent | 初始化 React、Mock API Types、页面线框 | 契约冻结，所有人都能独立启动各自模块 |
| **T2–6h** | Catalog/Seed/GET API、钱包初始状态 | 6+ Synthetic Dataset、规则匹配、Agent Mock | Research Request、Dataset Cards、Quote UI | GET Catalog + Agent Plan 可在 Stub 上跑通 |
| **T6–12h** | Quote、Purchase、Grant、Hash 与审计 | Agent 真正接入 Catalog、分析计算接口 | Chart、Receipt、Error States，替换部分 Mock | 最小交易流程能用 API/页面验证 |
| **T12–18h** | 防越权、余额/预算、幂等测试和路由注册 | 科学可比性测试、LLM 降级、图表数据校验 | E2E 联调、演示文档、异常演示 | 端到端 Happy Path 跑通；负例能触发 |
| **最后阶段** | 只修阻塞 Demo 的 Backend 问题 | 只修科学输出错误 | 稳定 UI、录像、README 与演示复盘 | 多次重置后的 Demo 可以重复成功 |

**主线优先级：** `Seed → GET datasets → Agent plan → Quote → Purchase → Download/Verify → Analysis → Chart`。所有高级功能排在这条线之后。第一次集成尽量发生在 T6h 前，不要等“全部写完”再联调。

**可用 Stub 解耦：**
- A 在 `POST /agent/plan` 未就绪时仍可通过手选 Dataset ID 测试 Quote → Purchase。
- B 用固定的 Dataset Summary JSON 测试 Agent 和分析，不依赖 A 数据库开发完成。
- C 使用与契约**完全相同**的 Mock Response 开发 UI，之后通过环境变量切换真实 API。
- 任一模块延期，也不能要求另一名成员跨目录接手并修改其核心代码；应缩减功能或明确重新分配所有权。

---

## 7. Git 与 Pull Request 防冲突制度

**分支：** 从 `main` 创建 `feat/platform`（A）、`feat/science-agent`（B）、`feat/frontend-demo`（C）。只通过小型 PR 合并到 `main`，禁止直接向 `main` push。

**每次 PR：**
1. 标题包含 Owner 和模块：`[A] Add quote and purchase APIs`。
2. 列出修改文件、使用的契约版本、如何本地测试、测试结果（不能只写“works”）。
3. 改了共享 API？必须先通过变更流程，不准在 PR 中偷偷改 Schema。
4. 每次只提交自己负责的文件。不要提交 `data/uploads/`、`*.db`、`.env`、API Key、`node_modules/` 或无关格式化修改。
5. PR 通过后先把新 `main` 同步到自己的分支，再开始下一段开发，避免长时间分支漂移。
6. 若 Git 显示冲突，**先联系文件 Owner**，不要通过直接覆盖其他人的分支来“解决”。

**简单通信格式（每 3–4 小时发一次）：**
```text
[成员 B | Science]
完成：POST /agent/plan（Mock 测试通过）
当前：接入 A 的 CatalogService
阻塞：需要 DatasetSummary.conditions.charge_rate_c
接口变更：无（或附契约提案）
下一步：实现电池衰减分析
```

---

## 8. 跨模块联调流程（按固定顺序）

1. **A** 执行 `reset_demo` + `seed_demo`，确保 3 Labs、6+ Datasets、Buyer 的 Demo Credits 初始余额，以及固定 IDs/价格。
2. **C** 在 Web 提交：“比较 25°C 和 40°C 电池容量衰减，预算 10 Credits。”
3. **B** 的 `/agent/plan` 返回 `ds_lab_a_25c_001` 与 `ds_lab_b_40c_001`、估计 7 Credits 和可比性警告；**不扣款**。
4. **A** 的 `/quotes` 重新计算价格，确认合计 7 Credits，状态允许购买。
5. **C** 展示 Quote，由用户点击确认后发送 `/purchases`。**A** 原子扣减，返回收据与 Grant；同一 `Idempotency-Key` 不得重复扣款。
6. **B** `/analysis/battery-aging` 通过 A 的 DeliveryService 获得验证后的已购数据，计算并返回两条曲线。
7. **C** 展示曲线、单位、来源和限制信息；A 的 Audit 中可追查交易与下载事件。
8. **安全负例：** 未购买下载应失败；超预算购买余额不变；篡改 CSV 后不能交付。
9. **重置并重跑**至少两次，记录结果。

**若中途失败，按边界归因：**
- Dataset 查询/报价/购买/权限/Hash/Audit 错误 → **A**。
- Agent 解析/选错候选/分析数值/比较警告错误 → **B**。
- HTTP 参数组装/状态管理/图表渲染/错误呈现/浏览器流程错误 → **C**。
- 如果失败来自 Contract 不一致 → **三人先对齐契约，再由每个 Owner 修自己的模块**。

---

## 9. 最低测试矩阵（每人必须交付）

| 测试案例 | A | B | C |
|---|---|---|---|
| 3 Labs / 6+ Datasets 正确导入，公开 Metadata 正确 | **负责** | 提供 Fixture | 调用/展示 |
| 预算 6、报价 7 → 拒绝且余额不变 | **负责** | 不得影响真实报价 | 错误反馈 |
| 同一 Idempotency Key 重试 → 仅扣一次 | **负责** | 不涉及 | 按钮去重 |
| 未购买不得下载或分析受控数据 | **负责授权** | **分析入口必须调用授权服务** | 反馈错误 |
| 更改 CSV → SHA-256 检测失败 | **负责** | 不得绕过验证 | 反馈错误 |
| 解析 25°C/40°C 查询、推荐正确 Dataset | 提供目录 | **负责** | 展示 |
| C-rate/实验条件差异 → 明确提示不可直接因果推断 | 提供元数据 | **负责** | 展示 |
| 购买成功后曲线字段/单位/来源正确 | 提供已授权数据 | **负责计算** | **负责绘图** |
| Reset 后完整流程可复现 | 提供 reset | 稳定输出 | **E2E 负责** |

**完成判定（Definition of Done）：** 任何队员按 README 启动后，都能在 Web 上完成一次真实 Backend 控制的**模拟数据购买**与科学分析；未授权、超预算、篡改和重复请求不会绕过后端检查；所有 UI 与说明清晰标注“模拟 Lab / 合成数据 / 模拟支付”。

---

## 10. 如果时间严重不足，如何砍功能

**必须保留：** 3 Labs + 6 Datasets、Catalog、Agent 规划（规则降级亦可）、Quote/Purchase、最基本授权/Hash、双曲线图、Reset、一条完整 E2E。

**优先舍弃（从先到后）：** Telegram/WhatsApp → Provider Upload UI → 真实 LLM 多轮工具调用（保留规则模式）→ 审计 Hash Chain（保留普通审计事件）→ 精美 Admin Dashboard → 复杂模型与预测。

**绝对不能为了赶工取消：** 后端的授权与预算约束、模拟交易标识、数据来源标识、禁止未经授权下载、数据篡改阻断。

---

## 11. 给 AI Coding Agent 的简短指令模板

把下面的内容附在各成员给 AI Coding Agent 的任务中：

```text
Project: SciExchange (3-person Hackathon MVP).
Read docs/HANDOVER.md, docs/TEAM_3_WORKSPLIT.md, and docs/API_CONTRACTS.md first.
You are acting for Member [A/B/C]. Modify ONLY files owned by Member [A/B/C]
under docs/TEAM_3_WORKSPLIT.md. Do not modify shared schemas, app/main.py,
other members' files, API paths, request/response shapes, or enums unless
explicitly approved through the contract-change process.
Implement the smallest testable slice. Use the frozen API contract and fixtures
for unfinished dependencies. Run relevant tests, list changed files, report
implemented/tested/planned status, and flag any dependency or contract mismatch.
Never claim real experiments, real payment, real cloud labs, or blockchain.
```

---

## 12. Kickoff 待填写项

- **成员 A：** __________________  **分支：** `feat/platform`
- **成员 B：** __________________  **分支：** `feat/science-agent`
- **成员 C：** __________________  **分支：** `feat/frontend-demo`
- **API Contract v1 已确认：** 是 / 否
- **本地 Demo Buyer 初始余额：** _____ Credits（建议至少 10）
- **核心 Dataset ID 与价格：** `ds_lab_a_25c_001` = 3、`ds_lab_b_40c_001` = 4
- **前后端运行地址与端口：** __________________
- **第一次端到端集成时间点：** __________________
- **最终 Demo 负责人：** C；后台运行保障：A；科学解释：B

*文档结束。建议提交到 `docs/TEAM_3_WORKSPLIT.md` 并与 `docs/HANDOVER.md` 一起提供给所有开发者。*
