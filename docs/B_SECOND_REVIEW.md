# B 第二轮独立审查与修复

日期：2026-10-22。审查基线：`codex/b-scientific-core` / `90296a4`。

范围：B 的 API、科学计算、匹配和数据处理。已修复 5 类问题，新增 31 项回归测试，共 152 项通过。

## 已复现并修复

| 问题 | 最小触发与影响 | 修复 |
|---|---|---|
| 极小 sigma 产生 HTTP 500 | 正常线性 Q(V)，`sigma_points=1e-200` 或 `5e-324`；SciPy 内部 sigma² 下溢为零，抛出未捕获的 ZeroDivisionError | 显式计算 Gaussian 支持半径；半径 0 时按恒等滤波处理。返回实际半径 |
| 0.05 V 边界依赖电压原点 | `linspace(3,3.05,11)` 的浮点跨度略小于 0.05，被拒绝；平移到 0–0.05 V 则接受 | 仅以 `1e-12` 相对容差处理阈值舍入；0.0499 V 仍拒绝 |
| 小容量下降段通过累计量检查 | Q 从 `5e-10 Ah` 单调降至 0，每步小于原来的固定 `1e-10 Ah` 容差；违反 `positive_cumulative` 仍分析成功 | 累计容量严格非递减，不自动消除噪声或重排数据 |
| 无效参比被当作已声明 | `reference_electrode=true`、对象、纯空白等让检查为 pass，Tafel 接口返回 200 | compiler 与 analytics 共用文本存在性判断；无效参比为 `not_checked`，分析返回 422 / `missing_reference` |
| 隔离来源仍显示通过 | 注入文本变为 `[QUARANTINED]`，但 `PROVENANCE_DECLARED=pass`；总报告仍为 REJECTED | 非空、非隔离文本才构成声明；缺失/无效/隔离时 `not_checked`，注入总拒绝保持不变 |

补丁复查进一步覆盖纯零宽字符、格式控制字符、插入零宽字符的隔离标记和全角隔离标记；共同判断复用既有 Unicode 规范化。这仍只验证声明存在，不鉴定参比或来源真实性。

方法与规则版本更新为 `science-1.1` 和 `science-rules-1.1`。原有元数据筛查模式未改变，`metadata-screen-1.0` 保持不变。数据文件、来源摘录、许可和哈希未修改。

## 其他检查项

| 检查项 | 处理结果 |
|---|---|
| 作图环境缺少 matplotlib | 已增加可选依赖安装提示；安装 `requirements-plots.txt` 后正常绘图 |
| `declared_hazards` 非列表 | 当前未约定 `list[str]` 契约，也未发现依赖它的故障路径。保留原始声明，由 A/B 接入时明确类型；不把未知类型静默改成 `[]` |
| 422 `detail` 类型不同 | 当前前端可处理 HTTP 错误。A 需统一错误外壳，同时保留科学错误码和 HTTP 状态 |
| `compare_conditions(None,None)` | 直接调用会报错，但现有调用方已校验输入。未发现当前流程中的可达缺陷，保持现有契约 |
| 重复表验证 | 暂无性能瓶颈证据，待测量后再优化 |
| 离线重建来源回退 | 离线 demo/tests 使用已提交切片；重新提取使用已验证缓存或 `--fetch`，暂不新增重建路径 |

## 验证结果

在仅安装 `backend/requirements-science.txt` 的独立 Python 3.11 环境中：

```bash
PYTHONPATH=backend .cache/b_review_venv/bin/python -m pytest backend/tests scripts/research/test_mine.py -q
```

**152 passed**，含新增的 31 项边界回归，见 `backend/tests/test_second_review.py`。有一条已知 Starlette/httpx TestClient 弃用提示。

8 份检查报告和 7 份分析结果除版本号及新增 Gaussian 半径字段外，与基线一致：Tafel 斜率约 `76.11 mV/dec`、R² 约 `0.98199`；早期窗口未检测到拐点，完整窗口候选为 cycle 876。7 个实验切片仍为 REVIEW_REQUIRED，合成故障切片仍为 REJECTED。

缺少绘图依赖时的提示、正常绘图、Python 编译检查和 `git diff --check` 均已验证。来源文件未重新下载，完整性由加载器和测试校验。

## 接线前需要 A/C 处理的差异

以下差异基于 A 分支 `codex/feat-scientific-core` / `a881e58` 和 C 分支 `frontend` / `eff0050`，需在集成时对齐。

1. **包路径与路由**：A 是根目录 `app/` 普通包，B 是 `backend/app/`；同名包会造成导入遮蔽。先约定统一路径或适配层，并选定唯一科学实现。B 路由已带 `/api/v1`，不能再叠加 A 的相同前缀。
2. **数据导入与许可**：A 的 `scripts/seed_slices.py` 调用 `app/services/slice_service.py`，后者将所有 `*.json` 当完整 `CompilerRequest`；B 是 manifest、metadata sidecar、CSV 和来源摘录。应先用 B `load_slices` 校验和组装，再映射业务字段；不要直接遍历所有 JSON，包括 manifest。保留来源与每个数据集的 CC-BY-4.0 归属信息，不能用统一 Apache-2.0 文本覆盖。
3. **共享 schema 与报告**：A `CompilerRequest` 不接受 B 的 `version`；A `SliceMetadata` 要求 B 没有的业务字段，并把未知温度设为必填浮点。业务字段应由 A 补充，未知温度保留 null。A/C 仍用旧形式化证明枚举及 `physics_results/violated_axioms`，B 用 `checks/coverage/REVIEW_REQUIRED`；A 还读取 B 没有的 `diagnostic_logs`。C `PhysicsCompilerConsole.tsx` 将所有 `valid=false` 显示为 Rejected，需改为三态展示；不要把待审状态映射成拒绝或“形式化证明通过”。
4. **版本与授权分析**：B 需要逐次调用 `(request, slice_id, version)` resolver，绑定授权、实际数据版本及完整性。A 的分析请求没有 version，且方法集合含 `dta`、不含 B 的 `capacity_fade`，需要显式对齐。现有 A 分析有授权检查，但这不等于已接好 B resolver；A 目前把 `is_attested` 绑定 `valid`，会挡住当前所有 REVIEW_REQUIRED 的真实切片。应另存可审计的人工准入决定，不能简单放开所有未阻断数据。
5. **前端实际接入**：C 的 `createLiveApi.analytics()` 仍明确拒绝实时分析，等待 B schema。A 现有单一 `/analysis`、非空参数拒绝及 `data.result` 外壳，与 B 的分领域端点、可配置参数和直接 `data` 结果不同。C 需选择具体授权切片及版本，传入方法、参数和 A 要求的凭证，并映射校验/凭证 Zod schema。B 安全告警保留字段与哈希，不返回注入原文，不能要求它提供 `pattern_matched` 原始文本。接线后再验证真实上架、审核、签名、交付与可选分析链路。

B 模块回归已通过，平台端到端联调仍待完成。
