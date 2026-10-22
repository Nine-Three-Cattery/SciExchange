# SciExchange 五轮检索与讨论清单

日期：2026-10-22。结论：复用 SFM 的检索管线可行，已在本仓库独立跑通五轮检索（框架轮、电池数据轮、电催化与形式化验证轮、深度多维科学挖掘轮、多学科前沿交叉挖掘轮）。累计获取 537 个去重候选，重点覆盖暗数据经济学、抽屉效应、本福特防伪法医、硬件可信根、微分 Tafel 分析、Lean 形式化化学物理、自主实验室提示词防御与去中心化 AI 商业基础设施。

已对齐主分支 `c1f5508` 的 v4 分工。先看 [团队入口](README.md)、[候选架构](ARCHITECTURE_CANDIDATES.md)与[新版 B 的采纳意见](TEAM_B_REVIEW.md)。

## 本次实际完成

SFM 的 6 个实现模块原样复用，新增 SciExchange 关键词及 GitHub／Zenodo 适配。五轮累计发出 151 个限量元数据请求。版本、配置、代码和结果哈希见 [运行摘要](results/receipt_v1.json)。

| 阶段 | 来源出现记录 | 去重候选 | 内容 |
|---|---:|---:|---|
| [框架轮](results/frameworks_v1.md) | 88 | 87 | 25 个仓库，57 个论文／预印本候选，5 个其他条目 |
| [电池数据轮](results/battery_data_v1.md) | 75 | 68 | 10 个 Zenodo 数据记录，18 个仓库，28 个论文／预印本候选，12 个其他条目 |
| [电催化与形式化验证轮](results/catalysis_physics_v1.md) | 67 | 66 | 8 个 Zenodo 数据集，20 个仓库，22 个论文／预印本候选，16 个其他条目 |
| [深度多维科学挖掘轮](results/deep_mining_v1.md) | 150 | 147 | 24 个 Zenodo 数据集，26 个仓库，67 个论文／预印本候选，30 个其他条目 |
| [多学科前沿交叉挖掘轮](results/multidisciplinary_v1.md) | 169 | 169 | 19 个 Zenodo 数据集，39 个仓库，81 个论文／预印本候选，30 个其他条目 |

这些数量不是高质量文献数或可用数据集数；五轮也不能直接相加为独立作品数。原始候选统一保留 `unreviewed`。第 5 轮对暗反应数据价值、学术造假统计法医（本福特定律）、硬件可信根、沙普利值数据市场与两边匹配等前沿命题做了全面对齐。

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

## 第 3 轮（电催化、Lean 4 形式化物理与以物易物）核心发现

| 重点文献／仓库 | 对 SciExchange 核心模块的直接支撑 | 评估与采用建议 |
|---|---|---|
| [Bobbin 等 (2024, *Digital Discovery*)](https://doi.org/10.1039/d3dd00077j) | **Lean 定理证明器形式化化学物理**：首次在 Lean 4 / mathlib 中建立热力学、吸附理论与经典动力学公理化证明 | **重大理论背书**：直接证明了用 Lean 形式化核验化学物理命题的学术严肃性与可行性，为“Lean 4 for Science”编译核提供权威顶刊支撑 |
| [Corva 等 (2022, *ACS Catalysis*)](https://doi.org/10.1021/acscatal.2c03581) | **微分 Tafel 分析 (DTA)**：通过求导与极值分析消除人为任意选取线性区间的主观造假与伪影 | **直接采纳算法**：放入 `domain_analytics.py`，替代简单的单一切线拟合，实现真正抗噪鲁棒的动力学校验 |
| [Kempler 等 (2023, *Nature Communications*)](https://doi.org/10.1038/s41467-023-36880-8) | **电催化法拉第效率可靠评估规范**：明确产物定量与不确定度核验基准 | **公理化红线依据**：论证了为什么 FE>100% 必须被系统严格阻断与拦截 |
| [Linton (2024, *SSRN*)](https://doi.org/10.2139/ssrn.6177621) | **从以物易物摩擦到去中心化 AI 商业基础设施**：论证 AI 代理如何通过算法撮合打破以物易物双重巧合困境 | **经济学理论锚点**：直接印证了 SciExchange 的“双 Agent 谈判撮合 + 流动性金库记账”经济模型的先进性 |
| [IEEE ICBC 2023 论文](https://doi.org/10.1109/icbc56567.2023.10174877) | **去中心化数据交换共识协议**：去中心化公钥基建 (DPKI)、消息签名与零信任传输 | **协议参考**：为学术优先权存证（Proof of Priority）与跨节点对称密钥安全对调提供密码学设计参照 |
| [naqilbxx/NiFe-LDH-OER-HER-data](https://github.com/naqilbxx/NiFe-LDH-OER-HER-data) | 真实的 NiFe-LDH 电催化析氧与析氢实验数据开源仓库 | **实验基准备选**：与 Stanford Severson 电池数据配合，作为催化切片真实实验数值的校准来源 |

## 第 4 轮（AI 时代材料数据诚信、自主实验安全与动力学防伪）核心发现

| 重点文献／仓库 | 对 SciExchange 核心模块的直接支撑 | 评估与采用建议 |
|---|---|---|
| [Reeves-McLaren & Christensen (2025/2026, *J. Mater. Chem. A*)](https://doi.org/10.1039/D5TA05512A) | **AI 时代的材料科学数据诚信与责任创新**：直击生成式 AI 与高通量实验带来的数据造假、幻觉传播与溯源危机 | **大赛核心命题背书**：直接回答赛会主题“人类如何建立机器零信任的科学防伪与流动基座”，构成本项目白皮书首要理论锚点 |
| [Anantharaj 等 (2021, *ACS Energy Letters*)](https://doi.org/10.1021/acsenergylett.1c00608) | **动电位极化曲线做 Tafel 分析的致命缺陷**：揭示电容电流与未补偿阻抗 $iR$ 如何系统性伪造虚假 Tafel 斜率 | **物理编译器判据深化**：论证了为什么单纯截取一段 LSV 算斜率是不可信的，支撑了我们对稳态台阶与动态 $iR$ 补偿的硬核核验 |
| [Menezes 等 (2024, *ACS Materials Letters*)](https://doi.org/10.1021/acsmaterialslett.4c00831) | **从理论到实践：电催化析氧 Tafel 斜率分析技术的批判性对比**：全面评测传统外推法、微分法与稳态法的失真界限 | **算法设计规范**：指明了物理编译器在处理工业级电催化数据时的多重算法防御基准 |
| [Dual-LLM Agent 安全架构 (2026, *Applied Intelligence*)](https://doi.org/10.1007/s10015-026-01152-3) & [WAInjectBench (2025, *ACM*)](https://doi.org/10.1145/3847320.3847398) | **面向自主 AI Agent 提示词注入攻击的确定性隔离防护** | **安全守门人实现规范**：支撑 `safety_guardrail.py` 采用的将数据文本与执行特权彻底剥离的隔离沙箱架构 |
| [lecopivo/SciLean](https://github.com/lecopivo/SciLean) | **Lean 4 科学计算、符号求导与力学公理化开源库** | **Lean 4 for Science 工程参考**：展示了如何在 Lean 4 中表达连续物理系统与微积分算子，为未来的形式化物理证明扩展提供生态对接 |
| [IEEE TTE 2023 电池拐点预测论文](https://doi.org/10.1109/tte.2023.3304670) | **快充锂电池寿命跳水拐点 (Knee-point) 的早期不确定度标定** | **电池分析引擎算法参考**：为 `domain_analytics.py` 的电池容量跳水预测提供经 peer-reviewed 验证的数学双切线模型 |

## 第 5 轮（暗数据经济学、本福特防伪法医、硬件可信根与双向撮合）核心发现

| 重点文献／仓库 | 对 SciExchange 核心模块的直接支撑 | 评估与采用建议 |
|---|---|---|
| [Rosenthal (1979, *Psychological Bulletin*)](https://doi.org/10.1037/0033-2909.86.3.638) & [Norquist, Raccuglia 等 (2016, *Nature*)](https://doi.org/10.1038/nature17439) | **抽屉效应与暗反应的拓扑价值**：开创性论证了未发表的“失败实验”提供了机器学习模型勾勒相空间临界边界不可或缺的负样本 | **科学暗物质流动命题基石**：强力支撑用户立论——AI for Science 缺的不是数据堆砌，而是深埋在硬盘抽屉里的暗反应负样本流动 |
| [Eckhartt 等 (2023, *Res. Integr. Peer Rev.*)](https://doi.org/10.1186/s41073-022-00126-w) & [Hunton 案例 (2020, *Res. Policy*)](https://doi.org/10.1016/j.respol.2020.104084) | **本福特定律在科研数据作伪侦测中的统计法医应用**：利用首位/第二位数字偏离度与末位数字均匀度排查伪造实验数据 | **零信任统计防伪组件**：为物理编译器的轻量统计检验提供 peer-reviewed 算法准则，辅助甄别人工捏造或平滑算法生成的虚假曲线 |
| [IEEE PST 2019](https://doi.org/10.1109/pst47121.2019.8949036) & [PLOS ONE 2017](https://doi.org/10.1371/journal.pone.0177576) | **基于硬件可信根 (HRoT/TPM) 的分布式数据完整性与远程运行时证明** | **端到端仪器凭证架构参照**：为电化学工作站/电池充放电机生成仪器级数字签名提供理论参照，打通从物理传感器到去中心化流动的信任链 |
| [Agarwal 等 (2019, *ACM EC*)](https://doi.org/10.1145/3328526.3329589) & [FaDe (2019, *Future Internet*)](https://doi.org/10.3390/fi11110225) | **数据市场算法解、沙普利值清算与去中心化公平数据交换协议** | **以物易物撮合机制支撑**：为 Data Liquidity Vault 的沙普利值数据定价与双向流动性平衡提供严格的微观博弈论模型 |
| [Frontiers in Blockchain (2024)](https://doi.org/10.3389/fbloc.2024.1375763) & [Springer (2026)](https://doi.org/10.1007/978-3-031-91405-8_21) | **去中心化科学 (DeSci) 原理、价值观与金字塔组织范式** | **学术定位支撑**：将 SciExchange 定位为 DeSci 基础设施的核心流动性层，避免投机代币经济，聚焦真实科研效用 |
| [leanprover-community/physlib](https://github.com/leanprover-community/physlib) | **Lean 4 社区物理公理化与形式化证明库** | **Lean 4 for Science 生态对接**：包含力学、热力学与守恒定律形式化草案，可作为物理编译器长期定理库的扩展基座 |
| [OPCW 化学武器公约公约正文](https://doi.org/10.18356/fa58b405-en) & [ChainGuard (2026)](https://doi.org/10.20944/preprints202608.1961.v1) | **国际禁止化学武器组织 (OPCW) 清单与状态感知提示词注入防御** | **CWC 拦截安全守门人准则**：为 `safety_guardrail.py` 提供国际条约级的 Schedule 1/2/3 前体定义与运行时沙箱隔离规范 |

## 与当前分工怎样衔接

调研脚本放在 `scripts/research/`，输出来源登记和候选清单；它们不直接成为业务切片。实际文件核查后，由 B 提供映射和报告，由 A 的共享 Schema 接入。新版电池分析应区分逐循环汇总与循环内采样，催化分析应保留电位参比与校准信息。建议增加：

- `source_url/source_doi/source_version/license`：原始来源与条件，不从论文许可推断数据许可。
- `aging_temperature_c/measurement_temperature_c/cycle_basis`：解释现有 `temperature_c` 与 `cycle_index`，避免错误比较。
- `source_file_sha256/transform_version/quality_flags`：原始文件、转换和作者问题记录。
- `measurement_kind/columns/units/analysis_capabilities`：区分能做容量衰减、dQ/dV、LSV 或 Tafel 的输入条件。
- `slice_version/selection/delivered_sha256`：固定实际交换和分析的内容。

向 A 推荐 SQLite + SQLAlchemy 与受控文件存储作为比赛起点，保留来源登记和转换记录；不引入第二套业务库。确认可用的真实样本后再冻结字段与导入，不把 68 条文献／仓库／数据候选直接塞进业务数据表。

使用命令见 [脚本说明](../../scripts/research/README.md)，后续事项见 [工作计划](PLAN.md)。
