# B 科学模块交接

本轮在 `codex/b-scientific-core` 实现，基于开发指南 `c1f5508`。目录和文件所有权沿用分工；科学规则以更新后的 [PHYSICS_RULES.md](PHYSICS_RULES.md) 为准。已有指南里的 `FORMAL_PROOF_VALID`、固定 42.5 mV/dec、240 mV 和“OC22 实验 LSV”不代表本轮实现或实测结果。

产品范围：数据库保存数据与审核/授权记录，平台核心负责检查、发现和交付；Tafel、dQ/dV 等作为交付后的可选参考分析和 demo，不承诺通用科研分析服务。[首次提交前审查](B_PRECOMMIT_REVIEW.md)记录初次交付；[第二轮审查](B_SECOND_REVIEW.md)记录后续修复、验证结果和 A/C 接线差异。

## 已可运行的内容

| 模块 | 调用入口 | 实际行为 |
|---|---|---|
| 数据准备 | `backend/scripts/prepare_science_data.py` | 来源校验、单位转换、可复现筛选，生成 8 个切片及来源文件 |
| 离线读取 | `app.services.science_io.load_slices(Path(...))` | 依据可信 manifest 校验元数据、CSV 和来源摘录的哈希；不执行数据库上架 |
| 科学检查 | `app.services.physics_compiler.verify(payload)` | 有限数、列与单位、FE 计算、循环顺序、条件性 CE/电压筛查，逐条返回覆盖情况 |
| 元数据筛查 | `app.services.safety_guardrail.screen_metadata(metadata)` | 有界递归扫描、注入样式隔离、少量化学名称复核提示 |
| 分析 | `app.services.domain_analytics.analyze(payload, method, parameters)` | Tafel、容量保持率、dQ/dV、描述性分段回归拐点 |
| 意图与匹配 | `app.agent.intent.parse_intent` / `matching.match_catalog` | 校验结构化需求，区分匹配、拒绝、条件未知；不假装完成自然语言理解 |
| 互换候选 | `matching.assess_barter` | 检查双方明确提出的需求，生成待人审候选；不执行交换或估价 |
| 条件比较 | `matching.compare_conditions` | 比较声明条件；不把缺失温度补成 25°C，不宣称因果推断 |

## 一次运行

从仓库根目录执行，Python 3.11：

```bash
python3.11 -m venv .venv
uv pip install --python .venv/bin/python -r backend/requirements-science.txt
PYTHONPATH=backend .venv/bin/python -m pytest backend/tests scripts/research/test_mine.py -q
PYTHONPATH=backend .venv/bin/python backend/scripts/run_science_demo.py
```

测试与演示读取仓库内的小切片，不需要网络。结果写入 `.cache/science_demo/results.json`，包含 8 份检查报告、7 份分析结果、双向需求匹配候选和条件比较。原始恶意备注不会出现在该结果的安全元数据或诊断日志中。

可选科学检查图：

```bash
uv pip install --python .venv/bin/python -r backend/requirements-plots.txt
PYTHONPATH=backend .venv/bin/python backend/scripts/plot_science_demo.py
```

图片位于 `.cache/science_demo/science_panels.png`。这只是 B 的计算检查图，C 的前端仍由 C 集成。

重新从来源提取：

```bash
uv pip install --python .venv/bin/python -r backend/requirements-data.txt
.venv/bin/python backend/scripts/prepare_science_data.py --fetch
```

默认缓存 `.cache/b_science`；要验证全新提取，用 `--cache <空目录> --output <新目录>`。电池原始 MATLAB 文件约 3 GB，脚本用 HTTP Range 只读选中 cell 的 summary、Vdlin、Qdlin；源站必须支持 Range。不要把提取文件哈希误当成整个原始 MATLAB 文件的哈希。

本次使用的 8 个电池数组另有固定规范化摘要，绑定来源 URL、cell、协议和提取版本；缓存重用和网络提取后均须与两次已核对提取的基线一致。缓存内容变更不会自动被接受为原始实验数据；合法源站更新也需人工核对后更新基线。

## 真实 demo 结果与可讲述的故事

| 项目 | 当前计算结果 | 展示边界 |
|---|---|---|
| NiFeC LDH 稳态 Tafel | 选取 0.3–10 mA/cm²，6 点；表观斜率约 **76.11 mV/dec**，R² 约 **0.98199** | 非作者论文结果的逐项复现；依赖记录的 iR 处理假设和所选区间 |
| η10 / FE | `null` / `not_checked` | 原表 pH/RHE 标定待核，所选表无气体产量与积分电荷；不输出 240 mV 或 99.2% |
| 电池前 100 周 | b1c5，保留 cycle 2–100，共 99 行 | cycle 1 是零值占位，保留在来源摘录中；协议是 **4.4C(80%)-4.4C** |
| 前 100 周拐点 | `not_detected` | 不用完整寿命结果冒充早期预测 |
| 完整观测区间拐点 | 约 **cycle 876**，`candidate_detected` | 分段线性描述性估计，非机理标签、非寿命预测或统计确认 |
| dQ/dV | cycle 10/50/100，约 2.3–3.3 V 内部区间，带符号负导数 | 放电累计容量随电压降低而增加，因此负值合理；不直接推断活性锂损失 |
| 合成故障切片 | `REJECTED` | 注入模式触发隔离；FE 108.2% 触发待复核警告，不能单独宣称证明学术造假 |

7 个真实切片均返回 `REVIEW_REQUIRED`，因为它们有未检查项或来源限制。前端应呈现“已执行哪些检查、还缺什么”，并把人工准入决定作为独立记录。不可把它们强制映射成绿色的 `FORMAL_PROOF_VALID`。

图形检查发现 b1c5 的 cycle 909 为孤立低容量点，随后回升。原切片及主拟合保留该点；报告返回 `isolated_capacity_anomaly_cycles=[909]`。单独的排除此点敏感性检查把断点从 876 改为 882，不能把单一断点当作已确定的材料失效时刻。

`catalysis_nifec_lsv` 的原表含 292 次正向、288 次反向电位步进，元数据标记为 `potential_sweep_with_return`。Tafel 函数对这类未分支切片返回 `ambiguous_sweep`；需要先选择单个分支、记录转换并形成新切片后拟合。当前演示使用独立稳态阶跃切片，结果不受此项修正影响。

## A 的接入点

### 数据与版本

`load_slices(Path("data/slices"))` 返回 `slice_id -> payload`。每个 payload 结构如下；完整样本可直接读取同名 JSON/CSV：

```json
{
  "slice_id": "battery_b1c5_early",
  "version": "1",
  "domain": "battery_cycling",
  "columns": ["cycle_index", "discharge_capacity_ah", "charge_capacity_ah", "average_temperature_c"],
  "rows": [[2.0, 1.0761266, 1.0761191, 30.99857108215291]],
  "metadata": {
    "units": {"cycle_index": "1", "discharge_capacity_ah": "Ah", "charge_capacity_ah": "Ah", "average_temperature_c": "degC"},
    "data_origin": "experimental",
    "temperature_c": null
  }
}
```

上面只有一行和部分元数据，用于说明结构。真实完整元数据包含来源、许可、转换和质量标记。A 可在自己的 `seed_slices.py` 使用这个加载器，把 CSV/JSON 灌入统一存储；数据库、交易状态与签名仍由 A 维护，不另建 B 的业务数据库。

CSV 哈希验证文件字节，`input_sha256` 验证整个规范化 JSON 输入，两者是不同对象，不要求相等。哈希本身不证明测量真实或科研优先权。平台应把版本、数据内容哈希、规则版本与人工审核记录绑定；改数据后重新检查。

`.gitattributes` 禁止 Git 自动转换这些 CSV/JSON 的换行符，确保跨系统拉取后哈希仍一致；两份催化来源 CSV 保留上游原始 CRLF 和编码，不要用编辑器自动格式化。

### 路由挂载

以下是 B 独立包的调用契约。A 在 `a881e58` 已有根目录 `app/`，与 B 的 `backend/app/` 同名；合并时先统一包路径/适配层，不能只设置 `PYTHONPATH=backend` 就假定两套 `app` 自动合并。B 路由已经包含 `/api/v1`，不要在 A 挂载时再加一遍该前缀。具体差异见[接线清单](B_SECOND_REVIEW.md#接线前需要-ac-处理的差异)。

编译接口：挂载 `app.api.compiler.router`。`POST /api/v1/compiler/verify` 接受 payload，HTTP 200 表示检查完成，查看 `data.compiler_status` 和 `data.checks` 判断结果。接口自身不创建上架、交易或凭证。

两个 B 路由通过 `ScienceJSONRoute` 在请求校验前检查标准有限 UTF-8 JSON：非法 JSON/孤立 surrogate/NaN/Infinity 返回 400，超过 4 MiB 返回 413，非 JSON 媒体类型返回 415，正常字段验证失败仍为 422。该大小检查发生在读取请求体后；A 的 HTTP 入口仍须配置传输缓存、并发与限流，不能把它当作完整拒绝服务防护。

分析接口：使用 `app.api.analysis.create_router(resolve_authorized_slice)`。A 提供一个异步函数，签名为：

```python
async def resolve_authorized_slice(request: Request, slice_id: str, version: str) -> dict:
    ...
```

这表示 A 的接入契约，并非本分支里已有的交付实现。该函数必须逐次验证调用者权限、付款/双签或公开许可授权，核对版本及内容完整性，再返回包含 rows 的 payload；未授权抛出 401/403/402 等平台异常。不要只按 ID 查到数据就返回。B 在调用此函数之前不会读取数据，随后再次核对 ID、版本、领域和阻断项。直接挂载默认 `analysis.router` 会返回 503。

端点：`POST /api/v1/analysis/catalysis` 或 `/battery`，请求必须含版本：

```json
{"slice_id":"catalysis_nifec_tafel","version":"1","analysis_type":"tafel_slope","parameters":{"current_min":0.3,"current_max":10.0,"target_current":10.0}}
```

其他 `analysis_type`：`capacity_fade`、`dq_dv`、`knee_point`。拒绝客户端提交 rows、文件路径等额外字段。每次分析都经过 resolver；成功返回 `{code,message,data,timestamp}`。业务错误目前使用 FastAPI 的 `detail` 异常响应，A 的全局异常层可统一外壳，但需保留实际 HTTP 状态。

目录匹配只接受 A 已按当前调用者筛选过的公开元数据项，还要求 `can_discover=true`。项需包含 ID/version/domain/columns/metadata，以及检查报告的 `blocking_failure` 和 `compiler_status`。匹配不能授权交付，`matched` 也不代表科学审核完成。

畸形目录项直接忽略，异常数值条件保留为未知；查询范围不接受布尔值或数字字符串隐式转换。任一互换 offer 不可发现或结构无效时，`condition_comparison=null`，不透露隐藏数据的条件差异。

### 与旧共享 Schema 的差异

- 新状态：`CHECKS_PASSED`、`REVIEW_REQUIRED`、`REJECTED`。旧的四类“形式化证明/物理造假/操作事故”枚举无法准确表达本轮结果，需要 A 调整。
- `valid=true` 仅指已执行规则全通过且没有待检查项；准入权限另由平台决策，不得只看 `blocking_failure=false` 就声称已验证全部物理性质。
- 催化参比可能是 `potential_v_vs_reference`，并非全部已有 RHE。温度、FE、η10 允许缺失；不能强制填默认值。
- `version` 是分析请求必填项。当前普通 Python/局部 Pydantic 边界可由 A 纳入共享 Schema；B 没有修改 `models/schemas.py`。

## C 的展示接入点

`checks` 中每项有 `rule_id/status/reason/observed_value/allowed_range/assumptions`；`coverage` 给出 pass/warn/fail/not_checked 数量。`diagnostic_log` 可直接作纯文本控制台内容。所有元数据即使没有匹配到恶意模式，也只能作为不可信数据展示，不能拼进 Agent 的系统指令。

图表字段：Tafel 用 `curve` 与 `fit`；容量用 `cycle_index/capacity_retention_pct`；dQ/dV 用 `voltage_v/dq_dv_ah_v`，返回的 x 轴是升序、导数保留负号；拐点用 `knee_point_cycle_estimated`，为 null 时不画预测拐点。缺失指标显示“未计算：条件不足”，不要显示 0。

## 验证与剩余边界

本轮测试覆盖合成解析曲线的已知数值、真实数据的合理范围、缺失单位/参比、FE 容差、容量恢复、导数方向、无拐点情况、注入隔离、文件篡改和路径边界，以及模拟 resolver 下逐请求授权和版本校验。测试环境有一条 Starlette/httpx TestClient 弃用提示，不影响当前测试结果。

2026-10-22 首次提交 `90296a4` 前验证：只按 `requirements-science.txt` 安装的独立 Python 3.11 环境中，**121 项通过**（含原文献挖掘测试）；新增测试不依赖开发机缓存。首次空缓存源站提取已验证；当时又使用独立提取缓存重建，全部生成文件逐字节一致。Python 编译检查及 `git diff --check` 通过。已实际打开检查科学图，记录了 cycle 909 异常与断点敏感性；当时 demo 的 8 份报告、7 个分析均可运行，主要数值不变。网络下载可用性只代表实际验证时点，离线测试和 demo 不依赖源站持续在线。

同日第二轮审查后，方法/规则版本更新为 `science-1.1` / `science-rules-1.1`。新增声明类型、Unicode 占位符和 dQ/dV 参数/数值边界回归；测试结果及与初次提交的输出对比见 [B_SECOND_REVIEW.md](B_SECOND_REVIEW.md)。数据文件及来源哈希未修改。

本轮交付是可运行的 B 科学模块。A 的真实权限/支付/双签/数据库和 C 的页面尚未联调；不报告整个平台端到端完成。没有 Lean/PhysLean 证明、完整 GHS/CWC 判定、仪器真实性鉴定、自然语言 LLM Agent、因果识别或失败数据经济价值验证。Arrhenius 检验因缺少多温度速率数据明确输出 `not_checked`。
