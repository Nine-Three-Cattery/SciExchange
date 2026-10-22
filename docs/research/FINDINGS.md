# SciExchange 两轮检索与讨论清单

日期：2026-10-22。结论：复用 SFM 的检索前半段可行，已在本仓库独立跑通。当前建议从现成项目借用数据模型、文件组织和导入组件；尚无本地运行证据支持直接替换整个 SciExchange 后端。

已对齐主分支 `257c951` 的 v4 分工。先看 [团队入口](README.md)、[候选架构](ARCHITECTURE_CANDIDATES.md)与[新版 B 的采纳意见](TEAM_B_REVIEW.md)。下文保留首轮检索结果；随后定向核对的新来源单独列出，不改变历史搜索统计。

## 本次实际完成

SFM 的 6 个实现模块原样复用，新增 SciExchange 关键词及 GitHub／Zenodo 适配。两轮各发出 16 个限量元数据请求，全部成功；每条普通搜索最多取 8 条，没有遍历全部结果。两轮的离线重放均得到逐字节相同的候选 JSONL，9 项测试通过。版本、配置、代码和结果哈希见 [运行摘要](results/receipt_v1.json)。

| 阶段 | 来源出现记录 | 去重候选 | 内容 |
|---|---:|---:|---|
| [框架轮](results/frameworks_v1.md) | 88 | 87 | 25 个仓库，57 个论文／预印本候选，5 个其他条目 |
| [电池数据轮](results/battery_data_v1.md) | 75 | 68 | 10 个 Zenodo 数据记录，18 个仓库，28 个论文／预印本候选，12 个其他条目 |

这些数量不是高质量文献数或可用数据集数；两轮也不能直接相加为独立作品数。原始候选统一保留 `unreviewed`，下文是另行阅读部分原始页面后的助手筛选意见。框架轮含 5 条种子核验请求，电池轮含 6 条；种子与搜索命中分别记录。

第一轮的 Crossref 长查询出现 Oracle Cloud 书籍、GitHub 广泛 README 检索出现合集和无关项目，说明默认排序有明显噪声。当前清单适合定向阅读，不能据命中数量评价召回率。继续扩展时应先缩短 Crossref 主题词、收紧 GitHub 查询，再考虑提高数量。SFM 已有的来源记录和身份核对比单纯增大抓取量更有价值。

## 先和队友讨论这几个框架

| 项目／论文 | 对本项目的具体帮助 | 当前判断 |
|---|---|---|
| [SciCat backend](https://github.com/SciCatProject/backend) | 科学数据目录、元数据、访问控制；可参考 Dataset 与来源记录设计 | 已读 README／BSD-3-Clause LICENSE。NestJS + MongoDB 与我们建议的轻量 FastAPI + SQLite 组合不同，先借鉴结构；未安装验证 |
| [datalab](https://github.com/datalab-org/datalab) | 样品／电芯元数据、实验文件、关系、Python API，支持电化学数据 | 本轮搜索新候选；已读 README／MIT LICENSE。与电池场景贴近，值得优先检查具体数据块与导入代码；整套含 MongoDB／数据存储服务，未本地运行 |
| [Ocean Market](https://github.com/oceanprotocol/market) | 数据发布、目录检索与购买流程的产品参考 | 已读 README／Apache-2.0 LICENSE。建议参考交互；完整链栈未验证，互换与付款仍需单独对接 |
| [AutoDataset 论文](https://arxiv.org/abs/2603.07271)及[代码](https://github.com/EIT-NLP/AutoDataset) | 从论文发现数据：摘要筛选 → 正文解析 → 数据链接抽取 → 检索 | 本轮新发现。已核对摘要与 README；涉及模型、GROBID 和检索依赖，当前页面未见明确仓库 LICENSE。作为流程参考，未采用代码 |
| [Scientific Data Skills](https://arxiv.org/abs/2608.19625v2) | 为 agent 组织数据说明、文件布局、使用步骤、质量检查和来源 | 本轮新发现的预印本，已进一步阅读第 3 节表示与构建、第 4 节资源库；据此建议版本化使用说明卡，效果数字未复现，不视为完整交易平台 |
| [Galvanalyser: A Battery Test Database](https://arxiv.org/abs/2010.14959) | 采集端 → PostgreSQL → Web／Python API，与电池数据汇集问题直接相关 | 已核对摘要；原文当时称代码拟开放，本次未验证现成可运行仓库，作为架构文献 |

这些是组件级建议，不是“某项目已包含我们全部功能”的结论。SciExchange 的提案、双方审批、清算和授权交付由 A 按共同契约实现，科学检查和分析由 B 提供。

**引用消歧：** [SciCat: A Curated Dataset of Scientific Software Repositories](https://arxiv.org/abs/2312.06382) 是科学软件仓库集合，与 SciCat 数据目录系统不是同一对象。目录系统对应的背景可读 [ICALEPCS 2023 官方论文](https://epaper.kek.jp/icalepcs2023/papers/thmbcmo02.pdf)。不要只按简称建立“论文—代码”关系。

另一个题目高度相关的搜索命中是 [Data Marketplace as a Platform for Sharing Scientific Data](https://doi.org/10.1007/978-981-10-7515-5_7)；当前只核对了 Crossref 题录，发布页未能读取，尚不能据题名概括其方法。

## 再处理电池数据

数据轮的 10 条 Zenodo 记录都取得了来源元数据与文件列表，API 中均声明 `cc-by-4.0`；这不替代实际文件与归属检查。其中至少两条描述明确是模拟数据，不能计作真实电池实验。

| 候选 | 本次核对到的条件 | 用途与下一步 |
|---|---|---|
| [Imperial 2022，7235858](https://zenodo.org/records/7235858) | LG M50T／21700，10／25／40°C，两个 SoC 区间；原包约 850 MB | 最贴近 25°C／40°C demo，优先选同一 SoC 区间的作者汇总 CSV；尚未取得完整原始包或入库 |
| [Imperial 2024，10637534](https://zenodo.org/records/10637534) | 同系列电芯，更广 SoC／工况；原文件总量约 49.4 GB | 作为扩展与元数据参考；与 2022 可能重叠，不能当成独立实验室或独立验证集 |
| [Panasonic NCR18650B，7896429](https://zenodo.org/records/7896429) | 发布描述为 116 电芯、37 种老化负载；可逐个下载 HDF5 | 第二个来源候选；先核对原文的逐电芯条件与实际文件，再确定温度组和转换器 |
| [Degradation path indicators，15755725](https://zenodo.org/records/15755725) | 发布描述为 48 电芯，包含初始／末期检查；每电芯 ZIP 约 16–24 MB，有约 17 KB 的指标表 | 适合小样本验证，需确认能否形成需要的容量—循环序列，不能仅凭“小文件”选用 |
| [WMG Calendar Ageing，14577286](https://zenodo.org/records/14577286) | 存储温度 0／25／45°C，日历老化 | 不直接与循环老化曲线混合，可做“条件不匹配”的检索负例 |

两条模拟来源：[17390606](https://zenodo.org/records/17390606)、[19491921](https://zenodo.org/records/19491921)。它们可作为另外的模拟数据类别，不能标记成 experimental。演示用合成故障输入也应与这些来源、真实实验分别记录。

对 Imperial 2022，发布说明有三点会直接影响入库：老化设定温度与统一 25°C 的 RPT 测量温度必须分开；不同 SoC 区间的循环数不可直接当成相同等效全循环；Expt 5 cell A 的第 4 次 RPT 有作者指出的电连接异常，应保留质量标记。真实容量原字段单位需要在实际 CSV 中核对后转换。

处理代码可优先评估 [Battery Data Toolkit](https://github.com/ROVI-org/battery-data-toolkit)（Apache-2.0）与 [BEEP](https://github.com/TRI-AMDD/beep)（Apache-2.0）；前者提供标准化数据与元数据组织，后者覆盖多类测试仪格式。若首批只用作者已经整理的容量汇总 CSV，简单的列映射可能就足够。与 Imperial 数据相关的 [batteryDAT](https://github.com/ImperialCollegeLondon/batteryDAT) 为 BSD-3-Clause，但 README 仍标记开发中，本次仅作处理方法参考。三者未安装或执行。

## 对齐新版提案补充的定向核对

这些条目未计入上述 87／68 个自动检索候选；核实范围是论文、官方页面和作者文件结构说明，尚未下载实验文件。

| 来源 | 已核实事实 | 对当前任务的判断 |
|---|---|---|
| [Severson 2019](https://doi.org/10.1038/s41560-019-0356-8) | [TRI 官方目录](https://data.matr.io/)标注该 124 电芯快充数据集 CC BY 4.0；[作者代码仓库](https://github.com/rdbraatz/data-driven-prediction-of-battery-cycle-life-before-capacity-degradation)区分逐循环 summary 与循环内 cycle 数据 | 新版电池任务优先核查；需选择具体电芯、确认实际文件与单位。数据许可不自动授权复制全部模型代码 |
| [TRI OER catalysis ACE-I](https://data.matr.io/oer-catalysis/) | 官方页标注 CC BY 4.0，4 组各 2000 种成分，提供成分及 3 mA/cm² 过电位指标的说明 | 实验催化优先候选；可评估成分—活性展示，不能据此宣称有完整 LSV/Tafel、FE 或 η10 |
| [OC22](https://arxiv.org/abs/2206.08917) | 原论文描述 DFT 弛豫与能量等计算任务 | 不作为实验 NiFe-LDH LSV/Tafel 的来源 |
| [OCx24](https://arxiv.org/abs/2411.11783) | 实验论文主要描述 HER 与 CO₂RR | 是不同反应的线索，不直接替代当前 OER 输入 |

## 与当前分工怎样衔接

调研脚本放在 `scripts/research/`，输出来源登记和候选清单；它们不直接成为业务切片。实际文件核查后，由 B 提供映射和报告，由 A 的共享 Schema 接入。新版电池分析应区分逐循环汇总与循环内采样，催化分析应保留电位参比与校准信息。建议增加：

- `source_url/source_doi/source_version/license`：原始来源与条件，不从论文许可推断数据许可。
- `aging_temperature_c/measurement_temperature_c/cycle_basis`：解释现有 `temperature_c` 与 `cycle_index`，避免错误比较。
- `source_file_sha256/transform_version/quality_flags`：原始文件、转换和作者问题记录。
- `measurement_kind/columns/units/analysis_capabilities`：区分能做容量衰减、dQ/dV、LSV 或 Tafel 的输入条件。
- `slice_version/selection/delivered_sha256`：固定实际交换和分析的内容。

向 A 推荐 SQLite + SQLAlchemy 与受控文件存储作为比赛起点，保留来源登记和转换记录；不引入第二套业务库。确认可用的真实样本后再冻结字段与导入，不把 68 条文献／仓库／数据候选直接塞进业务数据表。

使用命令见 [脚本说明](../../scripts/research/README.md)，后续事项见 [工作计划](PLAN.md)。
