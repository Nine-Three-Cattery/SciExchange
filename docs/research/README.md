# SciExchange 框架与数据调研

供 A、B、C 讨论实现方案和选择数据源。已对齐 `257c951` 的 v4 分工：B 负责科学数据、检查、分析及 Agent 匹配；共享 Schema、平台存储和交付接口由 A 维护。

建议采用模块化 FastAPI 后端，把数据切片、检查报告、双方审批和受控交付串起来。双领域演示可以保留，但实验 OER 数据源与电池循环内数据必须先核实。这里提供候选方案，不替代主分支白皮书或 A 的接口契约。

## 阅读顺序

1. [候选框架与推荐组合](ARCHITECTURE_CANDIDATES.md)：三种范围、组件来源、共同数据模型和 A/B/C 接口边界。
2. [新版分工 B 的采纳意见](TEAM_B_REVIEW.md)：哪些设计直接采用，哪些科学假设会导致错误实现，B 接下来交付什么。
3. [框架与数据源清单](FINDINGS.md)：精选来源、代码与数据许可、适用任务和核实状态。
4. [工作计划](PLAN.md)：已完成事项与后续顺序。

## 优先讨论的选择

| 任务 | 首选候选 | 选择条件 |
|---|---|---|
| 科学数据目录 | SciCat、datalab 的数据模型 | 借鉴组织方式；尚未部署这两个系统 |
| Agent 数据说明 | Scientific Data Skills 的使用说明组织方式 | 固定数据版本，提供字段语义、允许的分析和来源 |
| 电池格式适配 | Battery Data Toolkit；需要仪器解析时评估 BEEP | 先看实际文件，再决定是否需要依赖 |
| 快充与 dQ/dV | Severson 2019 | 作者说明包含循环内数据；实际文件和转换仍待检查 |
| 多温度容量衰减 | Imperial 2022 | 区分老化温度、RPT 测量温度和循环定义 |
| OER 实验候选 | TRI ACE-I | 当前确认的是成分与 3 mA/cm² 过电位，不能预设有完整 LSV/Tafel 数据 |

## 检索成果与复现

- 框架轮：[87 个候选](results/frameworks_v1.md)及[简化元数据](results/frameworks_v1.json)。
- 电池轮：[68 个候选](results/battery_data_v1.md)及[简化元数据](results/battery_data_v1.json)。
- [运行摘要](results/receipt_v1.json)：两轮各 16 个请求，候选数量、配置与代码哈希、原始本地候选哈希。
- [简化检索脚本](../../scripts/research/README.md)：复用 SFM 的 6 个 MIT 模块，保留上游版本和文件哈希；仅需 Python 3.10+ 标准库。

完整候选仍标记 `unreviewed`，精选判断单独写在上述文档。新增的 Severson、OC22 和 ACE-I 定向核对不回填为首轮自动检索命中。候选数不等于优质数据集数；实验文件尚未导入应用。

本分支发布脚本、简化元数据和讨论文档，不包含论文全文、实验原始大文件或 `.cache`。两轮逐字节重放是在保留原始 API 响应的本地缓存上完成的；新 clone 可运行测试或重新联网检索，但没有旧缓存就不能逐字节复现旧候选。在线结果会随来源更新。

```sh
python3 -m unittest discover -s scripts/research -p 'test_*.py' -v
python3 scripts/research/mine.py plan --phase frameworks --out .cache/research/framework_plan_review
```

代码许可与数据许可分别记录；原始数据许可不会因收录进 SciExchange 而改变。
