# B 第二轮独立审查与修复

日期：2026-10-22。审查基线：`codex/b-scientific-core` 的 `90296a41710c7c50722ca380010524403174063c`。

本轮实际使用本机 Antigravity 的 **Gemini 3.8 Flash Medium**，经用户确认后替代菜单中不可用的 High。Gemini 只读审查了 B 的 API、科学服务、匹配、数据脚本和测试，并执行了 112 项 backend 测试；另有两名独立审查 agent 分别检查 API 边界及数值实现。修复由主任务在复现后完成，不把 AI 建议直接视为已证实缺陷。

原始 Gemini 报告保存在本机 `.cache/antigravity_review.md`，未纳入运行时或测试依赖。其 SHA-256 为 `46d4120f151aba6b16aa30be988dc6eb2dafda90670b311699c840269a228b9c`。以下记录全部建议的处理结果，供团队评审；不沿用原报告未经验证的“鲁棒性强”“科学前提严密”等概括性评价。

## 已复现并修复

| 问题 | 最小触发与影响 | 修复 |
|---|---|---|
| 极小 sigma 产生 HTTP 500（独立数值审查） | 正常线性 Q(V)，`sigma_points=1e-200` 或 `5e-324`；SciPy 内部 sigma² 下溢为零，抛出未捕获的 ZeroDivisionError | 显式计算 Gaussian 支持半径；半径 0 时按恒等滤波处理，避免进入该公式。返回实际半径 |
| 0.05 V 边界依赖电压原点（独立数值审查） | `linspace(3,3.05,11)` 的浮点跨度略小于 0.05，被拒绝；平移到 0–0.05 V 则接受 | 仅以 `1e-12` 相对容差处理阈值舍入；0.0499 V 仍拒绝 |
| 小容量下降段通过累计量检查（独立数值审查） | Q 从 `5e-10 Ah` 单调降至 0，每步小于原来的固定 `1e-10 Ah` 容差；违反 `positive_cumulative` 仍分析成功 | 累计容量严格非递减，不自动消除噪声或重排数据 |
| 无效参比被当作已声明（独立 API 审查） | `reference_electrode=true`、对象、纯空白等让检查为 pass，Tafel 接口返回 200 | compiler 与 analytics 共用文本存在性判断；无效参比为 `not_checked`，分析返回 422 / `missing_reference` |
| 隔离来源仍显示通过（Gemini BUG-02） | 注入文本变为 `[QUARANTINED]`，但 `PROVENANCE_DECLARED=pass`；总报告原本仍为 REJECTED，因此不是绕过整体拒绝 | 非空、非隔离文本才构成声明；缺失/无效/隔离时 `not_checked`，注入总拒绝保持不变 |

补丁复查进一步覆盖纯零宽字符、格式控制字符、插入零宽字符的隔离标记和全角隔离标记；共同判断复用既有 Unicode 规范化。这仍只验证声明存在，不鉴定参比或来源真实性。

方法与规则版本更新为 `science-1.1` 和 `science-rules-1.1`。原有元数据筛查模式未改变，`metadata-screen-1.0` 保持不变。数据文件、来源摘录、许可和哈希未修改。

## Gemini 其余建议的核实与处理

| 原始编号 | 核实结果与本轮决定 |
|---|---|
| BUG-01：作图环境缺少 matplotlib | `requirements-plots.txt` 已明确声明可选依赖，基础环境不含它符合设计。作为使用体验改善，增加缺少该包时的安装提示和非零退出；已验证有依赖时仍正常绘图，不把它列为科学计算缺陷 |
| BUG-03：`declared_hazards` 非列表 | 透传字符串的现象属实，但当前 schema/文档未约定该字段必为 `list[str]`，现有下游也没有所声称的遍历崩溃路径。保留原始声明，不把未知类型静默改成 `[]` 而丢失危险信息。正式接入时由 A/B 明确类型与错误行为 |
| SUSP-01：422 `detail` 类型不同 | FastAPI 参数错误、HTTPException、ScienceError 的结构不同属实；当前前端先按状态抛出固定 ApiError，未发现所声称的崩溃。A 的全局异常层应统一外壳并保留结构化错误码和 HTTP 状态，避免仅 `str(detail)` 丢失语义 |
| SUSP-02：`compare_conditions(None,None)` | 绕过声明类型直接调用会 AttributeError，但当前生产调用 `assess_barter` 在进入前已校验双方记录和 metadata；畸形 offer 返回不满足需求及 null 比较。未确认当前可达缺陷，不增加与原返回契约不一致的错误对象 |
| SUGG-01：重复表验证 | 确有重复遍历；没有性能证据说明它阻断当前 20,000 行上限的 demo。本轮不重构验证入口，保留为有测量后再处理的优化项 |
| SUGG-02：离线重建从来源 CSV 回退 | 当前完整重提取依赖已验证缓存或显式 `--fetch`；全新克隆的离线 demo/tests 直接读已提交切片，可正常运行。未新增重建路径，避免引入第二套来源一致性流程 |

## 验证结果

在仅安装 `backend/requirements-science.txt` 的独立 Python 3.11 环境中：

```bash
PYTHONPATH=backend .cache/b_review_venv/bin/python -m pytest backend/tests scripts/research/test_mine.py -q
```

**152 passed**：原有 121 项加本轮 31 项；后者覆盖已知线性导数、充放电符号、合法跨度平移、严格累计量和声明边界。仍有一条已知 Starlette/httpx TestClient 弃用提示。新用例在 `backend/tests/test_second_review.py`，不依赖 `.cache` 里的报告或结果文件。

8 份 demo 检查报告和 7 份分析结果与基线逐字段比较：除方法/规则版本和新增 Gaussian 半径字段外完全一致。表观 Tafel 斜率仍为 `76.11055846211742 mV/dec`、R² 为 `0.9819871241645534`；早期窗口未检测到拐点，完整窗口候选仍为 cycle 876。7 个实验切片仍为 REVIEW_REQUIRED，合成故障切片仍为 REJECTED。

缺少 matplotlib 的独立环境会给出明确提示并退出；装有绘图依赖的开发环境成功生成检查图。Python 编译检查和 `git diff --check` 通过。本轮未重新下载来源文件；已有来源完整性由加载器和测试校验。

## 接线前需要 A/C 处理的差异

以下是只读核对的快照：A 为 `origin/codex/feat-scientific-core` / `a881e58`，C 为 `origin/frontend` / `eff0050`。这些分支已有实际后端/前端实现，不能再描述为“尚无数据库或主流程”。本轮未修改队友的实现；差异须在共同集成分支解决。

1. **包路径与路由**：A 是根目录 `app/` 普通包，B 是 `backend/app/`；同名包会造成导入遮蔽。先约定统一路径或适配层，并选定唯一科学实现。B 路由已带 `/api/v1`，不能再叠加 A 的相同前缀。
2. **数据导入与许可**：A 的 `scripts/seed_slices.py` 调用 `app/services/slice_service.py`，后者将所有 `*.json` 当完整 `CompilerRequest`；B 是 manifest、metadata sidecar、CSV 和来源摘录。应先用 B `load_slices` 校验和组装，再映射业务字段；不要直接遍历所有 JSON，包括 manifest。保留来源与每个数据集的 CC-BY-4.0 归属信息，不能用统一 Apache-2.0 文本覆盖。
3. **共享 schema 与报告**：A `CompilerRequest` 不接受 B 的 `version`；A `SliceMetadata` 要求 B 没有的业务字段，并把未知温度设为必填浮点。业务字段应由 A 补充，未知温度保留 null。A/C 仍用旧形式化证明枚举及 `physics_results/violated_axioms`，B 用 `checks/coverage/REVIEW_REQUIRED`；A 还读取 B 没有的 `diagnostic_logs`。C `PhysicsCompilerConsole.tsx` 将所有 `valid=false` 显示为 Rejected，需改为三态展示；不要把待审状态映射成拒绝或“形式化证明通过”。
4. **版本与授权分析**：B 需要逐次调用 `(request, slice_id, version)` resolver，绑定授权、实际数据版本及完整性。A 的分析请求没有 version，且方法集合含 `dta`、不含 B 的 `capacity_fade`，需要显式对齐。现有 A 分析有授权检查，但这不等于已接好 B resolver；A 目前把 `is_attested` 绑定 `valid`，会挡住当前所有 REVIEW_REQUIRED 的真实切片。应另存可审计的人工准入决定，不能简单放开所有未阻断数据。
5. **前端实际接入**：C 的 `createLiveApi.analytics()` 仍明确拒绝实时分析，等待 B schema。A 现有单一 `/analysis`、非空参数拒绝及 `data.result` 外壳，与 B 的分领域端点、可配置参数和直接 `data` 结果不同。C 需选择具体授权切片及版本，传入方法、参数和 A 要求的凭证，并映射校验/凭证 Zod schema。B 安全告警保留字段与哈希，不返回注入原文，不能要求它提供 `pattern_matched` 原始文本。接线后再验证真实上架、审核、签名、交付与可选分析链路。

本轮结论：已确认的 B 缺陷已修复并回归，适合继续团队评审与接线；独立模块测试不代表平台端到端验收，更不证明数据真实、全部注入可识别或科学结论普遍成立。
