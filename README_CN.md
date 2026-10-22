<div align="center">

# 🔬⚡ SciExchange
### 零信任科学数据流转网络、物理守恒校验器与跨学科数据以物易物协议

*专为 **Open Scientific Intelligence (OSI) Hackathon 2026**（前身为 Materials Science & Chemistry LLM Hackathon）打造。*  
*理论灵感源自陶哲轩 Math 2.0、Lean 4 形式化证明以及 Physlib 物理量纲体系。*

<p align="center">
  <a href="README.md"><b>English</b></a> •
  <a href="README_CN.md"><b>简体中文</b></a>
</p>

[![Hackathon](https://img.shields.io/badge/Hackathon-OSI%202026-6366F1?style=for-the-badge&logo=target&logoColor=white)](#)
[![Protocol](https://img.shields.io/badge/Protocol-x402%20%26%20Data%20Barter-06B6D4?style=for-the-badge&logo=lightning&logoColor=white)](#)
[![Kernel](https://img.shields.io/badge/Kernel-Python%20Numerical%20Checks-10B981?style=for-the-badge&logo=shield&logoColor=white)](#)
[![Governance](https://img.shields.io/badge/Governance-HITL%20Dual--Signing-F59E0B?style=for-the-badge&logo=auth0&logoColor=white)](#)
[![License](https://img.shields.io/badge/License-Apache--2.0-slate?style=for-the-badge)](LICENSE)

</div>

**当前实现：** 仓库已包含可运行的 Python/FastAPI 网关、科学数值检查、Ed25519 PI 授权与本地 SciCredit 结算。`FORMAL_PROOF_VALID` 是沿用的 API 状态名，表示通过数值协议检查。Lean 风格日志用于呈现诊断；当前没有运行 Lean 内核，也没有执行已形式化的 Lean 科学规范。

五组种子数据是**按项目指定参数生成的确定性合成测试集**，没有导入 OC22/Severson 原始文件，也没有校准复现这些数据集的数据分布。元数据明确记录 `source_type="synthetic_benchmark"` 与 `experimental_measurement=false`。实际启动命令与接口行为见[当前后端使用说明](BACKEND_USAGE.md)。

下文的 v4 架构与路演分镜还包含规划中的前端与网络功能。“10/90”是项目动机的叙事表达，并非本实现测得的结论。

---

## 🌟 核心问题宣言：暗物质的觉醒与零信任防伪的终极命题

在菲尔兹奖得主陶哲轩关于 **Math 2.0** 的论述中，AI 驱动的数学研究正从“证明稀缺”迈向“证明过剩”，而 **Lean 4** 扮演着绝对客观的机器零信任核验内核。在科学计算与理论物理前沿，这一浪潮催生了 **[Physlib](https://physlib.io/)**（物理定律形式化）与 **[SciLean](https://github.com/lecopivo/SciLean)**（科学计算形式化）。

然而，**AI for Science (AI4S) 面临着一个更深层的因果命题**：

> *“AI4S 之所以面临高质量数据的极度稀缺，**不在于数据本身不存在**，而在于无论那 **10% 真正能导向顶刊的黄金正向数据**，还是那 **90% 真实反映物理边界的失败实验数据**，目前都作为**‘科学暗物质’**，被死死封印在散落在世界各地单一实验室本地硬盘的孤岛中。*  
> *当 SciExchange 最终构建了去中心化科学（DeSci）的流动基座，将原本藏在暗处的数据集中引渡到阳光下之后，新的终极挑战随之而来：**在流动性喷涌的时代，人类与 AI 如何建立机器零信任的科学防伪与物理真伪验证底座？**”*

**SciExchange 将对等数据交换与科学不变量的数值检查结合起来，借鉴 Lean 显式核验的设计思路。**

```
                                  ┌── 10% 顶刊黄金数据 ────> 去中心化点对点撮合 + 双 Agent 谈判 + PI 双签以物易物
[ 实验室物理实验数据要素池 ] ──────┤                         (绝不强迫公开；促成手握不同领域关键成果的实验室对等合作)
                                  └── 90% 失败暗物质数据 ──> 声明式物理形式化编译器 + 切片流动性金库
                                                            (零被抢发顾虑；喂饱基础大模型决策边界，沉没资产变现)
```

---

## ⚖️ 范式革命：超越传统天真的“开源科学”

| 评审考察维度 | 传统开源科学 (天真的 Web2 思维) | SciExchange (v4.0 黄金参考实现) |
|---|---|---|
| **底层驱动机制** | 道德倡导 / 单向奉献 *(在现实中彻底失效)* | **对等以物易物（Data Barter）+ 流动性金库 + 沉没成本变现** |
| **10% 顶刊黄金数据** | 本地封锁 *(极度恐惧被抢先发表)* | **双 Agent 意图博弈 + 优先权存证（Proof of Priority）+ PI 双签** |
| **90% 失败暗物质数据** | 当作无用垃圾直接丢弃在硬盘中 | **公理化编译为 Tensor-Ready 切片，消除 AI 基础模型的幸存者偏差** |
| **信任验证机制** | 盲目信任 / 单薄的 SHA-256 文件哈希 | **受 Lean 4 启发的声明式物理守恒公理求解器（$\Phi_{\text{OER}}$, $\Phi_{\text{Battery}}$）** |
| **数据质量边界判定** | 垃圾进，垃圾出（Garbage in, Garbage out） | **阻抗与漂移基线公理，自动将高价值科学真阴性与学生操作事故剥离** |
| **AI 安全防御** | 易受包含恶意指令的 CSV 表头攻击 | **全自动 CWC 国际两用化学品过滤 + 间接提示词注入（Prompt Injection）沙箱** |

---

## 🏛️ 系统拓扑与夺冠四幕剧故事线

```
[ Lab A: 电催化 OER 实验室 ] ──┐
                               ├──> [ 声明式物理形式化公理编译内核 ] ──> [ 数据流动性金库 & x402 网关 ]
[ Lab B: 电池快充测试实验室 ] ──┘        (Physlib 量纲分析与热力学公理)                   │
                                                                                          ▼
[ 恶意节点 (伪造数据/Prompt注入) ] ──> ❌ COMPILE_ERROR: 违背热力学守恒公理      [ 人机协同双签授权 (HITL) ]
                                                                                          │
                                                                                          ▼
                                                                        [ Lean Atlas 风格依赖图谱与原子互换 ]
```

1. **第一幕：零信任编译 — 击碎学术造假与投毒**：恶意节点上传伪造催化切片（法拉第效率 108% 且含间接提示词攻击）。系统公理引擎秒级求解，判定违背电荷守恒，隔离恶意指令，亮起红牌拒绝挂牌。
2. **第二幕：跨学科双 Agent 自主发现与以物易物**：催化实验室（Lab A）与电池实验室（Lab B）发现需求高度互补。双方 Agent 自主达成无须法币的 **Data-for-Data Barter** 互换契约。
3. **第三幕：Human-in-the-Loop 人机双签授权**：系统向课题组长呈报「决策摘要卡」。人类 PI 使用私钥点击签名，与 Agent 形成 **不可伪造的人机联合签名（`Agent_Sig + Human_PI_Sig`）**，原子释放解密密钥。
4. **第四幕：原子对调交付与跨学科因果图谱**：切片同时解密。催化端渲染出 Tafel 斜率（42.5 mV/dec）与 $\eta_{10}=240\text{ mV}$；电池端呈现 $dQ/dV$ 衰减瀑布图与跳水拐点；因果安全护栏自动弹出环境协变量警示。

---

## 🚀 核心技术支柱

### 1. 受 Lean 启发的物理守恒校验器
* **数值协议检查**：重新计算测量衍生量，检查规定的物理与操作约束，通过后签发本地存证；
* **电催化公理集 ($\Phi_{\text{OER}}$)**：强制满足法拉第效率 $FE \le 100\%$、Nernst 电位界限与 Tafel 线性拟合残差（$R^2 \ge 0.98$）；
* **电池充放电检查 ($\Phi_{\text{Battery}}$)**：检查协议规定的库伦效率区间（$98\% \sim 100\%$）、充电 $dQ/dV$ 与 10 周容量变化趋势；
* **仪器有效性护栏**：检查溶液未补偿阻抗 $R_u \le 15\,\Omega$、iR 补偿 $\ge 85\%$ 与参比电极漂移 $\le 5\text{ mV}$，分别报告操作问题与守恒违规；
* **规范化张量切片 (Tensor-Ready)**：直接对接 PyTorch `DataLoader`，开箱即用。

### 2. 学术优先权存证（Proof of Priority & Anti-Scoop）
* 切片编译通过即铸造带密码学时间戳的可验证凭证（Attestation UID）；
* 永久锁定课题组的原始科学发现优先权，彻底消除科研人员在流转数据时“被抢发”的恐惧。

### 3. 双边以物易物与切片流动性金库 (Slice Liquidity Vault)
* **双边以物易物**：支持互补实验室之间的直接对等互换；
* **公平交换原子托管**：利用哈希预承诺与聚合多签，解决经典“公平交换难题”，杜绝单方违约；
* **流动性金库**：质押切片换取流动性凭证，化解以物易物“双重巧合难题”，支持 x402 毫秒级微支付。

### 4. 人机协同双签治理 (HITL Multi-Sig)
* 机器自主负责博弈谈判，人类科学家掌握最终决定权与责任锚定。

---

## 🎬 3 分钟录屏分镜头脚本指南 (Video Storyboard)

| 分镜与时间戳 | 画面焦点 (Visual) | 配音/旁白概要 (Voiceover) |
|---|---|---|
| **Shot 1 (0:00 - 0:25)** | 系统拓扑全景 + 陶哲轩 Math 2.0 引言 | *“AI4S 的数据被困在硬盘里成为暗物质。SciExchange 用 DeSci 唤醒流动，用物理定律守护真理。”* |
| **Shot 2 (0:25 - 0:55)** | 恶意切片上传 + 物理编译器控制台实时报错 | *“看编译器抓假：法拉第效率 108% 触发物理公理违例与提示词投毒隔离，红灯驳回！”* |
| **Shot 3 (0:55 - 1:30)** | 催化与电池双 Agent 以物易物谈判握手动画 | *“高校缺乏企业信用卡。催化 Agent 与电池 Agent 自主达成无须法币的 Data-for-Data Barter。”* |
| **Shot 4 (1:30 - 2:00)** | 人类 PI 决策卡弹出 + 私钥双签点击动效 | *“AI 负责谈判，人类掌握终审。两位人类 PI 联合签名，原子解锁两份高维科学切片！”* |
| **Shot 5 (2:00 - 2:35)** | 电催化 Tafel 拟合线与电池 $dQ/dV$ 图 | *“合成基准恢复了指定的 Tafel 斜率与充电相变峰。跳水拐点仅在观测轨迹提供足够证据时报告。”* |
| **Shot 6 (2:35 - 3:00)** | GitHub 开源徽章与结语 | *“SciExchange：让物理定律成为机器可信的基石。黄金参考实现已全部开源。”* |

---

## ⚡ 快速启动与本地复现

### 1. 环境准备
* 已实现的后端需要 Python 3.10+

### 2. 启动后端与物理编译器
```bash
# 在仓库根目录运行
python3 -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# 生成五组明确标注来源的合成基准与本地演示 PI 身份
python scripts/seed_slices.py
python scripts/setup_demo.py

# 执行物理形式化公理验证测试
pytest tests/ -v

# 启动 FastAPI 网关服务
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 3. 运行演示与前端联调

在另一个已激活虚拟环境的终端运行 `python scripts/demo_exchange.py`，即可演示真实 HTTP 编译、PI 签署与下载流程。交互式 API 文档位于 `http://127.0.0.1:8000/docs`。

控制台设计见[前端架构文档](docs/FRONTEND_ARCHITECTURE.md)；当前分支尚无 `frontend/` 应用。前端应显示 API 返回的实际数据来源与验证范围，不能把合成切片标为导入实验，或把数值检查标为 Lean 证明。

---

## 🔬 学术溯源与核心文献引用 (Academic Grounding & Seminal References)

SciExchange 的底层逻辑严格立足于材料科学、形式化验证、电催化动力学与科学社会学的同行评审顶刊研究：

| 研究领域与核心论点 | 权威顶刊文献与 DOI | 对 SciExchange 架构的直接理论贡献 |
|---|---|---|
| **90% 失败暗物质在 AI4S 的价值** | **Raccuglia 等 (2016)**<br>*Nature* 533, 73–76<br>[doi:10.1038/nature17439](https://doi.org/10.1038/nature17439) | 证明**失败/未成功的反应数据**对于训练高泛化材料预测大模型至关重要，奠定了**数据流动性金库（Data Vault）**的理论基石。 |
| **学术发表偏倚与暗数据消失** | **Fanelli, D. (2012)**<br>*Scientometrics* 90, 891–904<br>[doi:10.1007/s11192-011-0494-7](https://doi.org/10.1007/s11192-011-0494-7) | 论证了全球科研界“负结果加速消失”的系统性发表偏倚，证明必须通过去中心化经济激励将 90% 失败暗数据盘活。 |
| **科学社会学与“成果被抢发恐惧”** | **Merton, R. K. (1957)**<br>*Am. Sociol. Rev.* 22(6), 635–659<br>[doi:10.2307/2089193](https://doi.org/10.2307/2089193) | 科学社会学奠基之作：解释了科学家保护 10% 黄金数据的核心恐惧是“被抢先发表 (Scooped)”，论证了**双边以物易物与学术优先权存证**优于强迫开源。 |
| **电催化析氧黄金基准** | **Tran 等 / Meta FAIR (2022)**<br>*ACS Catalysis* 12, 14068<br>[doi:10.1021/acscatal.2c05426](https://doi.org/10.1021/acscatal.2c05426) | 氧化物电催化数据集的背景参考。当前生成器没有导入 OC22 文件；NiFe-LDH LSV 曲线是按项目指定参数生成的合成测试数据。 |
| **实验伪影、未补偿阻抗与虚假 FE** | **Anantharaj 等 (2018)**<br>*Energy Environ. Sci.* 11, 744<br>[doi:10.1039/C7EE03457A](https://doi.org/10.1039/C7EE03457A) | 顶刊警示：揭露学术界大量存在的虚假 Tafel 斜率、未补偿溶液阻抗 ($iR$) 与超越 100% 的虚假法拉第效率，构成本编译器公理核的核心规则。 |
| **电池快充寿命预测基准** | **Severson 等 / 斯坦福 & MIT (2019)**<br>*Nature Energy* 4, 383–391<br>[doi:10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8) | LFP 快充场景的背景参考。当前 100 周汇总与循环内曲线由数学模型生成，没有复现某个 Severson 实测电芯或寿命。 |
| **物理信息机器学习 (PIML)** | **Karniadakis 等 (2021)**<br>*Nature Reviews Physics* 3, 422<br>[doi:10.1038/s42254-021-00314-5](https://doi.org/10.1038/s42254-021-00314-5) | 提供了在数据流经管道时强制注入物理不变量与守恒律的理论框架。 |
| **数学定理形式化证明** | **de Moura & Ullrich (2021)**<br>*CADE 28*, LNCS 12699, 625–635<br>[doi:10.1007/978-3-030-79876-5_37](https://doi.org/10.1007/978-3-030-79876-5_37) | 提供显式核验与诊断呈现的设计启发。当前编译器执行 Python 数值检查，没有 Lean 证明引擎或已编码的 Lean 科学规范。 |
| **Lean 形式化化学物理** | **Bobbin 等 (2024)**<br>*Digital Discovery* 3, 264–280<br>[doi:10.1039/d3dd00077j](https://doi.org/10.1039/d3dd00077j) | 英国皇家化学会顶刊成果：首次在 **Lean 定理证明器** 中形式化热力学与表面吸附定律，为科学实验数据的形式化物理编译提供了首个同行评审范例。 |
| **微分 Tafel 动力学分析 (DTA)** | **Corva 等 (2022)**<br>*ACS Catalysis* 12, 13805–13812<br>[doi:10.1021/acscatal.2c03581](https://doi.org/10.1021/acscatal.2c03581) | 提出基于导数极值的微分 Tafel 分析法，彻底杜绝人为选取线性拟合区间的偏置与造假，构成本项目自动化动力学校验的算法核心。 |
| **电催化极化曲线失真陷阱** | **Anantharaj 等 (2021)**<br>*ACS Energy Lett.* 6, 1607–1611<br>[doi:10.1021/acsenergylett.1c00608](https://doi.org/10.1021/acsenergylett.1c00608) | 揭示动态极化曲线因电容与未补偿 $iR$ 造成的伪 Tafel 斜率，直接论证了本系统物理编译器坚持稳态与阻抗校验的必要性。 |
| **AI 时代材料科学数据诚信** | **Reeves-McLaren & Christensen (2025/2026)**<br>*J. Mater. Chem. A*<br>[doi:10.1039/D5TA05512A](https://doi.org/10.1039/D5TA05512A) | 针对黑客松核心命题的顶刊研判：如何在生成式 AI 与材料大模型飞速发展时捍卫数据真实性、实验可复现性与机器零信任。 |
| **科研作伪侦测与本福特定律** | **Eckhartt 等 (2023)**<br>*Res. Integr. Peer Rev.* 8, 1<br>[doi:10.1186/s41073-022-00126-w](https://doi.org/10.1186/s41073-022-00126-w) | 确立了利用本福特定律多有效位统计法医自动侦测伪造科研数据与平滑篡改的算法准则，为零信任检验提供同行评审支持。 |
| **科学“抽屉效应”奠基理论** | **Rosenthal, R. (1979)**<br>*Psychological Bulletin* 86(3), 638–641<br>[doi:10.1037/0033-2909.86.3.638](https://doi.org/10.1037/0033-2909.86.3.638) | “抽屉问题 (File Drawer Problem)”开山论文：论证深埋在实验室抽屉里的负结果与未发表反应对避免科学认识论偏差的不可替代性。 |
| **数据市场算法微观结构** | **Agarwal 等 (2019)**<br>*ACM EC '19*, 709–710<br>[doi:10.1145/3328526.3329589](https://doi.org/10.1145/3328526.3329589) | 提出数据市场的算法解与沙普利值清算机制，为点对点数据定价、两边匹配与去中心化公平交易提供微观博弈论基础。 |
| **AI 两用化学安全防御** | **Urbina 等 (2022)**<br>*Nature Machine Intelligence* 4, 189<br>[doi:10.1038/s42256-022-00465-9](https://doi.org/10.1038/s42256-022-00465-9) | 实证揭示生成式 AI 会被滥用生成《化学武器公约》(CWC) 一类神经毒剂，支撑了我们自动两用物项与 Prompt 隔离安全防护。 |
| **自主实验室防间接提示词注入** | **Applied Intelligence (2026)**<br>*Appl. Intell.*<br>[doi:10.1007/s10015-026-01152-3](https://doi.org/10.1007/s10015-026-01152-3) | 确立了面向自主科学 Agent 与自动化实验室物理执行器的 Dual-LLM 确定性隔离防御架构。 |
| **AI 以物易物与市场微观结构** | **Linton (2024)**<br>*SSRN* 电子期刊<br>[doi:10.2139/ssrn.6177621](https://doi.org/10.2139/ssrn.6177621) | 制度经济学论著：探讨了从传统以物易物双重巧合摩擦，到去中心化 AI 智能体驱动商业清算基础设施的演进，为**双 Agent 撮合与数据金库**提供了扎实的经济学理论基石。 |

---

## 📚 完整工程文档索引

* ⚙️ **[当前后端使用说明 (BACKEND_USAGE.md)](BACKEND_USAGE.md)**：已实现的接口行为、实际数据来源、本地配置与可执行命令。
* 📑 **[项目系统设计白皮书 (SciExchange_Handover.md)](SciExchange_Handover.md)**：包含完整的数学公式、Lean 4 映射、数据契约与路演讲稿。
* 🤖 **[Codex 敏捷开发总纲 (docs/CODEX_IMPLEMENTATION_GUIDE.md)](docs/CODEX_IMPLEMENTATION_GUIDE.md)**：面向 AI 编程代理的分步工程实施指南。
* ⚙️ **[后端与物理编译器架构 (docs/BACKEND_ARCHITECTURE.md)](docs/BACKEND_ARCHITECTURE.md)**：接口契约、公理求解核与 x402 中间件说明。
* 🎨 **[前端与视觉交互指南 (docs/FRONTEND_ARCHITECTURE.md)](docs/FRONTEND_ARCHITECTURE.md)**：深色玻璃拟态设计系统、DAG 图谱与图表规范。
* 🔬 **[科学框架与数据集调研报告 (docs/research/FINDINGS.md)](docs/research/FINDINGS.md)**：Shaokang (B 组) 针对 87 个科学数据平台与 68 个电池/催化数据集的挖掘结果。
* 👥 **[三人敏捷分工协作表 (SciExchange_Task_Allocation.md)](SciExchange_Task_Allocation.md)**：团队角色、文件所有权与 48 小时冲刺时间表。

---

<div align="center">
  <sub>专为 Open Scientific Intelligence (OSI) Hackathon 2026 打造。开源遵循 Apache-2.0 License。</sub>
</div>
