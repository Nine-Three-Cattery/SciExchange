# 🔬⚡ SciExchange — 终审路演 PPT 详细设计大纲与实战蓝图
### Comprehensive Pitch Deck Blueprint, Visual Guidelines & 180s Screencast Choreography

**团队名称：** Laplace Flower Shop (拉普拉斯花店)  
**项目名称：** SciExchange (v1.0.0 Golden Release)  
**赛会轨道：** OSI Hackathon 2026 (Materials Science & Chemistry AI Track)  
**设计目标：** 打造冲刺全赛会特等奖（Grand Prize）的国际一流路演幻灯片与视频转场分镜体系  
**适用载体：** 16:9 (1920×1080 / 2560×1440) Figma · Keynote · PowerPoint · OBS 视频剪辑

---

## 🎨 视觉设计规范体系 (Cyber-Science Glassmorphism Design Tokens)

为确保路演幻灯片与全真 Web 控制台在视觉心理学上 100% 呼应，PPT 制作统一采用 **深色赛博科学风（Cyber-Science Dark Glassmorphism）**：

| 设计维度 | 规范参数与色值 | 视觉心理学与工程意图 |
| :--- | :--- | :--- |
| **主背景底色** | `#0B0F19`（极深曜石黑，带微弱的星云径向微光） | 消除评委视觉疲劳，营造前沿重大科研装置/前沿指挥中心的沉浸感 |
| **第一强调色 (Accent)** | `#06B6D4`（电子青天蓝）与 `#10B981`（电催化翡翠绿） | 象征物理守恒律、科学严密性、通过验证的机器可信状态 |
| **警告/阻断色 (Danger)** | `#F43F5E`（荧光覆盆子红）与 `#F59E0B`（琥珀金） | 用于违例拦截、Prompt 注入隔离、离群敏感性与因果护栏警示 |
| **容器卡片 (Glass Cards)** | `background: rgba(15, 23, 42, 0.72); backdrop-filter: blur(16px);` | 半透明毛玻璃质感，打破传统白底 PPT 的平庸廉价感 |
| **高亮微边框 (Borders)** | `border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 12px;` | 精致的微发光线框，使信息模块层次分明、极具锐度 |
| **主标题字体** | `DM Sans` / `Inter` / `Montserrat`（Bold，700~800 字重） | 现代、有力、具备国际化科技顶刊审美 |
| **数据与代码字体** | `IBM Plex Mono` / `JetBrains Mono`（中等字重，等宽微光） | 用于公式、公理代码、哈希摘要、物理单位（$\text{mV/dec}$）呈现 |

---

## ⏱️ 180 秒视频时间轴与切屏调度表 (Timeline & Transition Matrix)

> **黄金法则**：评委最反感“纯念 PPT”或“只有界面没有理论格局”。  
> **SciExchange 采用 70 秒 PPT 理论定调 + 110 秒全真控制台实操的穿插叙事模型：**

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ [0:00-0:25] ──> [0:25-0:45] ──> [0:45-1:15] ──> [1:15-1:40] ──> [1:40-2:05] ──> [2:05-2:35] ──> [2:35-3:00]  │
│  Slide 1&2       Slide 3&4       Scene 2 实操     Scene 3&4 实操    Scene 5&6 实操     Slide 8         Slide 9   │
│ (暗物质危机)      (Math 2.0架构)   (当场抓造假)      (易货与双签)      (分析与金库)     (548测试全绿)     (花店开源) │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| 时间区间 | 呈现画面 | 对应幻灯片 / 实操界面 | 视觉核心动作与解说焦点 |
| :--- | :--- | :--- | :--- |
| **00:00 - 00:25** | PPT 全屏 | **Slide 1 & Slide 2** | 宏大封面破题 $\to$ 揭露 10% 黄金数据私藏与 90% 失败暗物质沉没危机 |
| **00:25 - 00:45** | PPT 全屏 | **Slide 3 & Slide 4** | 引入陶哲轩 Math 2.0 公理化思想 $\to$ 展开四幕协同系统拓扑全景 |
| **00:45 - 01:15** | **实操切屏** | **Scene 2 (编译器控制台)** | **【高潮 1·当场抓造假】** 提交 108.2% 虚假切片，红光警报轰鸣，物理违例与 Prompt 注入当场隔离；编译正向切片生成优先权 UID |
| **01:15 - 01:40** | **实操切屏** | **Scene 3 & 4 (易货与双签)** | **【高潮 2·博弈破局】** 催化与电池双 Agent 动态光流撮合 $\to$ 弹出 PI 决策卡 $\to$ 演示“单签锁死、双签原子解密” |
| **01:40 - 02:05** | **实操切屏** | **Scene 5 & 6 (图表与金库)** | **【高潮 3·沉没成本变现】** LSV/Tafel 拟合线与 $dQ/dV$ 交互缩放 $\to$ 展示因果护栏 $\to$ 质押失败数据赚取 SciCredit 积分 |
| **02:05 - 02:35** | PPT 全屏 | **Slide 8 (工程实证)** | 亮出 548 项测试全绿硬核数据，阐明 `REVIEW_REQUIRED` 与拐点诚实性 |
| **02:35 - 03:00** | PPT 全屏 | **Slide 9 (开源结语)** | 浪漫点题拉普拉斯花店，放出 GitHub 开源徽章与架构白皮书 |

---

## 📑 逐页深度设计蓝图 (Slide-by-Slide Detailed Blueprints)

---

### Slide 1: 封面 · 创世之光 (Hook & Grand Vision)

* **核心定位**：打破平庸，用极客浪漫主义与高阶理论格局秒抓眼球。
* **版式布局 (16:9)**：
  * **背景**：深邃曜石黑，右侧浮现半透明的电催化极化流线与电池相变晶格粒子动效。
  * **左侧 65%（核心信息区）**：
    * 顶部徽标群：`OSI Hackathon 2026` · `Materials Science & Chemistry AI Track` · `Apache-2.0`
    * 主标题（72pt，极光蓝绿渐变）：**SciExchange**
    * 副标题（22pt，等宽字体）：`Zero-Trust Scientific Data Fabric, Physical Invariant Compiler & Multi-Agent Barter Protocol`
    * 思想溯源小注（15pt，柔和灰）：*Inspired by Terence Tao's Math 2.0, Lean 4 Formal Verification, and Physlib.*
  * **右下角署名卡片**：
    * **Team: Laplace Flower Shop (拉普拉斯花店)**
    * *“Nourishing open scientific intelligence with the 90% dark failure data of human endeavor.”*
* **本页配音脚本 (0:00 - 0:12)**：
  > “Welcome to SciExchange — a zero-trust scientific data fabric and physical formal compiler for AI for Science. Built by Team Laplace Flower Shop, our mission is to turn the dark data of human endeavor into verifiable machine intelligence.”

---

### Slide 2: 痛点 · AI4S 的“数据暗物质”与信赖危机 (The Dual Crisis)

* **核心定位**：直击科学界面临的最隐秘结构性痛点，展现对科学社会学与科研实践的深度洞察。
* **版式布局**：左右对立双毛玻璃卡片（Split Contrast Layout）。
  * **左卡片（红光微描边 · 90% 数据的死亡）**：
    * 标题：**90% 数据暗物质消失 (The File Drawer Problem)**
    * 核心事实：失败的化学反应、衰减的电池寿命被当成垃圾丢弃在硬盘。
    * 学术引用角标：*Raccuglia et al. (Nature 2016) & Fanelli (Scientometrics 2012)*
    * 致命后果：大模型在纯正面样本中训练，产生极其严重的**幸存者偏差（Survivorship Bias）**。
  * **右卡片（黄光微描边 · 10% 黄金数据的私藏与造假）**：
    * 标题：**10% 突破数据恐慌与造假 (Fear of Scooping & Fraud)**
    * 核心事实：科学家害怕“被抢先发表”而绝不轻易开源；公开数据中充斥虚假法拉第效率（$FE > 100\%$）与未补偿阻抗伪影。
    * 学术引用角标：*Merton (1957) & Anantharaj et al. (Energy Environ. Sci. 2018)*
    * 致命后果：垃圾数据注入，导致科学基座大模型产生严重物理幻觉。
* **本页配音脚本 (0:12 - 0:25)**：
  > “AI for Science does not suffer from data generation, but from a fatal paradox: 90% of failure data is dumped, creating severe model survivorship bias; while 10% breakthrough data is locked away over fear of being scooped. Worse, fabricated data and prompt injections threaten foundation models.”

---

### Slide 3: 范式 · 从陶哲轩 Math 2.0 到物理科学 (Paradigm Shift)

* **核心定位**：理论降维打击——将数学定理证明的确定性迁移到物理化学领域。
* **版式布局**：上下对比推演卡片。
  * **上部分（理论基石）**：
    * 陶哲轩 Math 2.0 宣言 $\to$ Lean 4 定理证明器 $\to$ 物理公理守恒谓词。
    * 核心公理公式高亮：
      $$\Phi_{\text{OER}}: FE = \frac{z \cdot n \cdot F}{Q_{\text{total}}} \le 100.0\% \quad\land\quad \Phi_{\text{Battery}}: 98\% \le CE \le 100\% \quad\land\quad E \ge 1.229\text{ V}$$
  * **下部分（范式对比表格）**：
    * **传统开源平台 (Naive Web2)**：道德倡议开源（无法落地） $\to$ 盲信未经验证的 CSV $\to$ 零防抄袭保护 $\to$ 伪影投毒。
    * **SciExchange 黄金范式**：**对等以物易物 + 失败金库** $\to$ **Lean 4 启发物理公理编译器** $\to$ **时间戳学术优先权存证** $\to$ **CWC与安全沙箱隔离**。
* **本页配音脚本 (0:25 - 0:35)**：
  > “Terence Tao envisions Math 2.0, where Lean 4 guarantees mathematical truth. SciExchange brings this to the physical world: replacing blind trust with declarative physical invariant compilation.”

---

### Slide 4: 架构 · 系统拓扑与四幕协同引擎 (System Topology)

* **核心定位**：展示全栈闭环架构的工程成熟度与优雅拓扑。
* **版式布局**：清晰的四幕协同流水线图（横向四步进胶囊）。
  * **Step 1: 物理形式化编译**：公理求解器求解电荷守恒与动力学区间，扫描 CWC 两用物与提示词注入；
  * **Step 2: 自治 A2A 撮合**：双边智能体跨域识别对等需求，生成以物易物（Data Barter）协议；
  * **Step 3: 人机双签治理 (HITL)**：人类 PI 桌面私钥双签，单签锁死、双签原子对调解密密钥；
  * **Step 4: 高维洞见与因果护栏**：生成 PyTorch Tensor，渲染 LSV/Tafel 与 $dQ/dV$ 相变图，激活因果防混淆护栏。
* **本页配音脚本 (0:35 - 0:45)**：
  > “Our architecture orchestrates four seamless acts: from first-principles compilation, autonomous agent barter discovery, to human PI dual-signing and causal-guarded analytics.”

---

### Slide 5: 杀手锏 I · 物理公理编译器与造假拦截 (Demo 承接)

* **对应实操**：00:45 - 01:15 切换至 Web 控制台 Scene 2 实录。
* **PPT 要点速记（配合视频切屏画中画）**：
  * 🚨 **造假拦截**：电催化切片虚构 $FE = 108.2\% > 100\%$，触发 `AXIOM_FARADAIC_EFFICIENCY_MAX`，瞬间驳回；
  * 🚨 **安全沙箱**：检测到嵌入在仪器备注中的间接提示词注入（`INDIRECT PROMPT INJECTION`），深度隔离；
  * 🛡️ **微观伪影**：未补偿溶液阻抗 $R_u = 124.5\,\Omega \gg 15.0\,\Omega$，识别为操作失误；
  * ✅ **真实切片**：通过检验后，实时生成 Merkle 根并铸造不可篡改的 **Proof of Priority UID**。
* **实操旁白脚本 (0:45 - 1:15)**：
  > “Watch the compiler catch fraud live: an adversarial dataset claiming 108.2% Faradaic efficiency is instantly rejected by charge conservation, while an embedded prompt injection is quarantined. Conversely, authentic slices pass verification, minting an immutable Proof of Priority UID.”

---

### Slide 6: 杀手锏 II · 智能体以物易物与人类 PI 私钥双签 (Demo 承接)

* **对应实操**：01:15 - 01:40 切换至 Web 控制台 Scene 3 & 4 实录。
* **PPT 要点速记（配合视频切屏画中画）**：
  * 🤝 **自主以物易物 (Data-for-Data Barter)**：催化 Agent（需电池特征）与电池 Agent（需催化模型）自动撮合，**无需法币门槛**；
  * 🔒 **人类知情同意 (HITL Governance)**：AI 负责谈判，但**无权擅自交出知识产权**；
  * 🔑 **Ed25519 零信任双签**：双方人类实验室主任（PI）审阅决策卡并使用本地私钥双签；
  * ⚡ **单签锁死，双签原子解锁**：单方批准绝不放行，双方签名就绪后原子对称解密交付。
* **实操旁白脚本 (1:15 - 1:40)**：
  > “To overcome fear of being scooped, autonomous agents negotiate an atomic, currency-free barter. But AI cannot leak lab assets. SciExchange mandates Human-in-the-Loop dual-signing: only when both human PIs sign with local Ed25519 keys does the protocol atomically release data.”

---

### Slide 7: 杀手锏 III · 90% 失败金库与跨域因果护栏 (Demo 承接)

* **对应实操**：01:40 - 02:05 切换至 Web 控制台 Scene 5 & 6 实录。
* **PPT 要点速记（配合视频切屏画中画）**：
  * 🏦 **流动性金库 (Data Liquidity Vault)**：验证合格的负向失败数据质押入库，铸造 **SciCredit 科研信用积分**，沉没成本直接变现；
  * 📊 **双域高阶动力学分析**：LSV 极化线拟合 Tafel 斜率（$b = 42.5\text{ mV/dec}$，$\eta_{10} = 240\text{ mV}$），电池 $dQ/dV$ 相变峰定位；
  * ⚠️ **因果安全护栏 (Causal Guardrail)**：醒目黄色告警，严禁跨学科模型将碱性水系催化与非水系电池环境做无校准因果推断。
* **实操旁白脚本 (1:40 - 2:05)**：
  > “Furthermore, our Data Vault monetizes 90% failed experiments: depositing verified negative data earns SciCredit to acquire new benchmarks. In the analytics console, our Causal Guardrail prevents AI models from learning spurious correlations across different experimental environments.”

---

### Slide 8: 实证 · 548 项测试全绿与学术求实壁垒 (Engineering Rigor)

* **核心定位**：彻底拉开与一般黑客松“吹水项目”的距离，展现工业级工程品相。
* **版式布局**：硬核数据仪表盘 + 学术严谨性宣言。
  * **左侧硬核指标 (Hard Numbers)**：
    * `363 Passed`：后端物理公理求解器、事务隔离与 Nonce 防重放测试
    * `185 Passed`：前端 20 套 Vitest 状态机、对抗测试与故障恢复
    * `5 Passed`：真实跨进程 Playwright 完整协议 E2E 测试
    * `0 Error / 0 Warning`：TypeScript 与 ESLint 全量通过
  * **右侧高维壁垒：坚守学术求实 (No Over-claiming)**：
    * 坦承基于文献严谨建模的基准与真实切片特征；
    * 面对前 100 周平滑无跳水的电池数据，系统如实输出 `identified: false`，**绝不造假虚构拐点**；
    * 真实实验细节无法完全自动化盖戳时，客观标注 `REVIEW_REQUIRED`，**绝不伪造全绿灯**。
* **本页配音脚本 (2:05 - 2:35)**：
  > “SciExchange is verified by 548 rigorous automated tests. We take pride in scientific honesty: flat battery trajectories report ‘no knee detected’, and incomplete records are flagged as ‘review required’. We refuse to over-claim or fabricate green lights.”

---

### Slide 9: 结语 · 拉普拉斯花店与开源宣言 (Grand Finale)

* **核心定位**：极客浪漫升华，点题队名，宣布开源，留给评委强烈的记忆点与情感震撼。
* **版式布局**：大气居中排版。
  * **中心大标题**：**Making Physical Laws the Bedrock of Machine Trust.**  
    *(让物理定律成为机器可信的基石)*
  * **开源物料矩阵**：
    * GitHub 开源地址 · Apache-2.0 协议
    * 完整架构白皮书 `SciExchange_Handover.md`
    * 18 篇顶刊权威学术论证文献矩阵
  * **底部诗意签名**：
    * **Team: Laplace Flower Shop (拉普拉斯花店)**  
    * *Nourishing open scientific intelligence with the dark data of human endeavor.*
* **本页配音脚本 (2:35 - 3:00)**：
  > “Making physical laws the bedrock of machine trust. Built with passion by Team Laplace Flower Shop, our complete reference implementation is fully open-source. Join us in illuminating scientific dark matter. Thank you!”

---

## 👥 三人团队敏捷分工与交付物矩阵 (Teamworks & Agile Matrix)

在 PPT 第 8 页或尾页角落，以精致卡片展现高效敏捷团队分工：

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Team Laplace Flower Shop (拉普拉斯花店)                          │
├──────────────────────────┬──────────────────────────┬──────────────────────────────────┤
│ 🧑‍💻 Member A (架构与协议)  │ 🔬 Member B (少康 · 科学) │ 🎨 Member C (Alan · 前端与交互)   │
├──────────────────────────┼──────────────────────────┼──────────────────────────────────┤
│ • FastAPI 网关与公理核    │ • 537 篇文献挖掘与 18 顶刊 │ • Cyber-Science 暗黑玻璃拟态 UI   │
│ • Ed25519 零信任双签协议 │ • Meta OC22 & 斯坦福数据管线│ • LSV/Tafel/dQdV 双域交互动态图表│
│ • x402 门禁与流动性金库  │ • CWC 毒剂与 Prompt 注入负样│ • 离线私钥双签决策面板与防重放    │
│ • SQLite 事务防死锁与 Nonce│ • IUPAC/ASE 标准张量化管线│ • 中英双语秒级无损热切换          │
└──────────────────────────┴──────────────────────────┴──────────────────────────────────┘
```

---

## 🛡️ 终审答辩“杀手级提问”防守锦囊 (Q&A Defense Cheat Sheet)

| 评委刁难问题 | 核心考点 | 降维打击标准反击话术 |
| :--- | :--- | :--- |
| **Q1: 你们到底跑了 Lean 4 内核没有？** | 验证真实性 | **“我们坦诚说明：当前版本实现的是 Lean 风格的公理化诊断协议（Lean-inspired Protocol Checkers）。** 我们选择在 200ms 内确定性拦截物理佯谬（如 $FE > 100\%$）与提示词毒化，避免在网关盲目挂载几十 GB 的重型证明器。这是通向物理世界统一形式化规范的最实用第一步。” |
| **Q2: 只做了电催化和电池，怎么推广到全材料领域？** | 扩展性 | **“架构完全解耦与插件化。** 编译器遵循 IUPAC/ASE 标准张量接口，任何课题组或实验中心，只需声明自己的守恒公理谓词，就能像加载插件一样无缝接入 SciExchange 验证网。” |
| **Q3: 高校体制内怎么可能用代币买数据？** | 经济学落地 | **“以物易物（A2A Barter）才是科学家之间的核心主战场！** 顶尖科研缺的不是几百块钱，而是对方独有的黄金实验切片。x402 是为未来的无人自主实验室（Self-Driving Labs）预留的高频微结算接口，而针对人类科学家，我们的 SciCredit 积分池盘活的是 90% 废弃的失败数据。” |
| **Q4: 为什么不用现有 Hugging Face 托管？** | 差异化壁垒 | **“第一，科学家害怕被抄袭抢发，绝不敢公开托管未发表的数据；第二，通用平台没有任何物理验证能力，一个包含 108% 效率的造假数据集混进去，AI 就会中毒。SciExchange 是专为科学智能打造的专用可信网。”** |

---

## 🛠️ 制作与实战录制操作核对清单 (Pre-recording Checklist)

- [ ] **运行环境**：录屏严格使用 `VITE_DATA_MODE=mock`，确保界面秒开、双签秒过、零卡顿；
- [ ] **画质参数**：1080P (1920×1080) 或 2K (2560×1440)，60fps，关闭浏览器书签栏；
- [ ] **配音语速**：英文控制在每分钟 135 ~ 145 单词，镜头与幻灯片切换处预留 1.5 秒画面呼吸停顿；
- [ ] **开源检查**：GitHub 仓库主页 README 排版锐利，徽章全部点亮，无坏死链接。
