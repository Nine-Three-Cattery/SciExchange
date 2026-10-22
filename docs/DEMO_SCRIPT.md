# SciExchange — 3 分钟录屏分镜与终审交付剧本 (3-Minute Screencast Storyboard)

**文档责任人：** Alan (Member C - 前端交互、双签可视化与夺冠视频录屏)  
**录屏规格：** 1080P / 2K, 60fps, 现代深色玻璃拟态 UI 全屏录制  
**总时长约束：** 严格控制在 3 分钟以内 (180 秒)  
**语言版本：** 默认英语配音 + 中英双语字幕 (Bilingual Subtitles)

---

## 1. 秒级分镜路线图 (Second-by-Second Roadmap)

| 镜头编号 | 时间窗口 | 核心画面与 UI 交互 | 核心想要传递的价值 | 旁白解说词 (English Script) | 中文对照参考 |
|---|---|---|---|---|---|
| **Shot 1** | **0:00 – 0:30** (30s) | 全景首页暗黑玻璃界面，展示三位一体架构（DeSci流动基座 + Lean 4 物理编译器 + 人机双签以物易物） | 破题：科学暗物质与零信任痛点 | *"Welcome to SciExchange — the decentralized data fabric and physical formal compiler for AI for Science. Today, 90% of valuable scientific failure data is dumped, while golden data is locked in siloed hard drives. How can we bring this dark matter into the sunlight with zero-trust machine verification?"* | 欢迎来到 SciExchange。在今天的 AI4S 中，90% 的失败暗物质被抛弃，10% 黄金数据锁在私有硬盘。我们如何让暗物质照进阳光并建立机器零信任？ |
| **Shot 2** | **0:30 – 1:00** (30s) | 点击选择 `slice_fraud_fake_oer_002`，点击【Compile & Attest】。编译终端爆出深红警告，实时拦截 $FE=108.2\%$ 违背热力学第一定律，并弹出间接 Prompt 注入隔离 | 震撼点：Lean 4 for Science 机器防伪与 AI 安全拦截 | *"Watch this: a fraudulent electrocatalysis slice claiming 108.2% Faradaic efficiency attempts verification. SciExchange acts as 'Lean 4 for Science', solving conservation laws in real-time. Instantly, it rejects the slice, flagging uncompensated resistance and isolating a concealed prompt injection attack."* | 看这个：一份声称 108.2% 法拉第效率的伪造切片试图认证。SciExchange 充当科学界的 Lean 4 求解守恒律，瞬间驳回造假，同时隔离隐藏的提示词注入反客为主攻击。 |
| **Shot 3** | **1:00 – 1:30** (30s) | 切换到 Meta OC22 催化切片与 Stanford Severson 电池切片，绿灯秒级编译通过。展示双 Agent 自动识别供需，生成以物易物提案（Barter Proposal） | 核心机制：A2A 撮合与避免 Scooping 泄密 | *"Now, we compile authentic slices from Meta OC22 and Stanford fast-charging benchmarks. Both pass axiomatic proof. Instead of forcing public dumps where PIs fear being scooped, autonomous agents discover complementary needs and propose an atomic barter swap."* | 现在编译真实基准切片，公理证明秒级全绿通过。不必强迫公开开源避免被 scooped，双智能体自动撮合跨领域供需，发起以物易物。 |
| **Shot 4** | **1:30 – 2:05** (35s) | 弹出【Human PI Dual-Signing】弹窗。展示单方签名锁定、双方课题组长私钥联合签名后，原子对调两份数据明文，并生成学术优先权时间戳 | 伦理与安全高潮：人机协同与学术优先权保护 | *"Crucially, agents cannot unilaterally leak lab data. SciExchange mandates Human PI Dual-Signing. Only when both laboratory PIs verify and cryptographically sign with their private keys does the protocol atomically release symmetric keys and mint Proof of Priority."* | 最关键的是，Agent 绝不能擅自出卖实验室机密。SciExchange 强制人类课题组长私钥双签。只有当双方 PI 确认签署，协议才原子对调密钥并铸造学术优先权存证。 |
| **Shot 5** | **2:05 – 2:35** (30s) | 切换至科学深度分析视窗：左侧实时拟合出高精度 Tafel 斜率（42.5 mV/dec），右侧呈现 100 周 $dQ/dV$ 相变漂移瀑布图，顶部高亮黄色因果安全护栏提示 | 硬核科学实力：张量就绪与因果护栏 | *"Data is immediately Tensor-Ready for PyTorch. On the left, we compute high-fidelity Tafel slopes from LSV curves; on the right, differential capacity dQ/dV waterfalls predict battery degradation. Notice our built-in causal guardrail, preventing models from learning spurious experimental artifacts."* | 交付数据即刻 Tensor 就绪。左侧根据 LSV 曲线拟合 Tafel 斜率，右侧 $dQ/dV$ 瀑布图预测电池衰减，内置因果护栏避免模型学习伪影。 |
| **Shot 6** | **2:35 – 3:00** (25s) | 镜头拉回，展示 90% 失败数据质押至 Liquidity Vault 铸造 SciCredit 流程，展示 GitHub 开源仓库、MIT 协议与总结全景 | 升华结语：重塑未来去中心化科学基座 | *"By transforming 90% failed dark matter into liquidity, and protecting 10% golden data with Lean-4 physics and human dual-signing, SciExchange establishes the true zero-trust foundation for Open Scientific Intelligence. Thank you."* | 盘活 90% 失败暗物质为流动性，以物理公理和人机双签守护 10% 黄金数据，SciExchange 打造面向未来的科学零信任流动基座。谢谢！ |

---

## 2. 录屏前预演检查清单 (Pre-flight Checklist)

- [ ] **分辨率与缩放：** 建议使用 Chrome 浏览器全屏模式（1920x1080 或 2560x1440），页面缩放保持 100%；
- [ ] **数据与状态复位：** 录制前在终端运行 `python backend/scripts/reset_demo.py`，确保数据库清空至初始未编译、未签名状态；
- [ ] **离线双轨备用：** 确认 `VITE_USE_MOCK=true` 时前端能脱离网络正常交互，真实后端运行时 `VITE_USE_MOCK=false` 能秒级响应；
- [ ] **光标与点击：** 录屏软件开启光标点击高亮动效（如 ScreenFlow / OBS Studio / Loom），动作平稳利落，重点按钮悬停 0.5 秒再点击；
- [ ] **音频与字幕：** 麦克风降噪清晰，语速控制在每分钟 130~150 英文单词，录制后使用剪映/Premiere 生成中英双语下潜字幕。
