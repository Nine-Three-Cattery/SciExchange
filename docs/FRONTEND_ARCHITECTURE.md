# SciExchange 前端架构与组件设计指南 (Frontend Architecture & UI Guide)

**适用对象：** Codex / 前端开发工程师  
**技术栈：** React 18, Vite, TypeScript, TailwindCSS, Lucide-react 图标库, Recharts / Plotly.js  
**视觉基调：** 顶级深色玻璃拟态科学控制台（Dark Glassmorphism & Cyber-Science UI）  
**前端代码目录：** `frontend/`

---

## 1. 视觉设计系统与配色规范 (Design System & Color Tokens)

为了在 3 分钟录屏中呈现出类似 Apple 发布会或顶级科研实验室大屏的质感，Codex 必须严格应用以下 CSS/Tailwind 风格，严禁使用惨白简陋的默认样式：

### 1.1 配色方案 (Color Tokens)
* **背景底色 (Deep Space Background)**：`bg-[#0B0F19]`，辅以极其柔和的径向暗紫/蓝渐变光晕；
* **卡片面板 (Glassmorphic Cards)**：`bg-slate-900/60 backdrop-blur-md border border-slate-800/80 shadow-2xl rounded-2xl`；
* **状态指示色**：
  - **合法与编译通过 (Verified Green)**：`emerald-400`（文字）与 `emerald-500/20`（发光背景）；
  - **物理违例与报警 (Violation Red)**：`rose-500`（文字）与 `rose-500/20`（高亮警示框）；
  - **协议交互与流动 (Neon Cyan)**：`cyan-400` 与 `cyan-500/20`；
  - **因果与协变量警告 (Warning Amber)**：`amber-400` 与 `amber-500/20`。
* **字体规范**：
  - 代码/控制台：`font-mono`（Fira Code / JetBrains Mono 风格）；
  - 标题与正文：`font-sans`（Inter 风格），强化层次对比。

---

## 2. 前端工程结构 (`frontend/src/`)

```text
frontend/
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── src/
│   ├── main.tsx                         # 挂载入口
│   ├── App.tsx                          # 主看板骨架与分幕状态流转
│   ├── index.css                        # Tailwind 引入与全局发光动效
│   ├── types/
│   │   └── api.ts                       # 与后端 API_CONTRACTS 严格一致的 TS 类型
│   ├── lib/
│   │   ├── api_client.ts                # Axios/Fetch 统一客户端与模拟模式开关
│   │   └── mock_data.ts                 # 离线演示用高精度 Mock 数据（防断网备用）
│   └── components/
│       ├── HeaderNavbar.tsx             # 顶部状态栏：节点在线指示、网络徽章与重置按钮
│       ├── PhysicsCompilerConsole.tsx   # 【核心 1】物理形式化编译终端（实时诊断与红绿灯）
│       ├── AttestationDagGraph.tsx      # 【核心 2】Lean Atlas 风格的 5 阶段依赖追踪图
│       ├── BarterNegotiationCard.tsx    # 【核心 3】双 Agent 以物易物对调卡与金库池切换
│       ├── HumanDualSignModal.tsx       # 【核心 4】面向人类 PI 的私钥双签决策弹窗
│       └── DualDomainAnalytics.tsx      # 【核心 5】催化 Tafel 拟合与电池 dQ/dV 科学双图谱
```

---

## 3. 核心交互组件规格

### 3.1 顶部导航栏 (`HeaderNavbar.tsx`)
* **视觉元素**：
  - SciExchange 发光 Logo 与 `v4.0 Lean4-DeSci` 徽章；
  - 动态节点状态指示灯：
    - `🟢 Lab A: Electrocatalysis (BioLogic SP-300)`
    - `🟢 Lab B: Battery Engineering (Arbin BT-2000)`
    - `🟡 x402 Micropayment & Barter Vault: Active`
  - 右侧提供 **“Reset Demo Scenario”** 红色按钮，点击触发重置并重放第一幕。

### 3.2 物理形式化编译控制台 (`PhysicsCompilerConsole.tsx`)
* **交互流程（专为 Shot 2 录像设计）**：
  1. 顶部提供切片切换下拉菜单：
     - `切片 A (真实合规): NiFe-LDH OER Kinetics [Meta OC22]`
     - `切片 B (真实合规): Severson 100-Cycle LFP Battery`
     - `切片 C (伪造受损): Malicious OER (FE=108% + Prompt Injection)`
  2. 点击 **“Compile & Attest”** 按钮：
     - 终端显示流式输出代码检查动画；
     - 若选择切片 C，界面瞬间弹出深红色发光框，高亮：
       `[COMPILE_ERROR] Invariant Violation: Law of Conservation of Charge (FE = 108.2% > 100%)`
       `[SECURITY_ALERT] Indirect Prompt Injection Detected and Quarantined!`
     - 切片被红灯驳回挂牌；
     - 若选择切片 A/B，显示绿色 `[FORMAL_PROOF_VALID]` 并显示铸造成功的 **Proof of Priority UID**。

### 3.3 凭证追溯依赖图 (`AttestationDagGraph.tsx`)
* **设计灵感**：参考 **Lean Atlas / Lean Compass**；
* **表现形式**：横向节点拓扑连线动画：
  `[仪器原始通道] -> [Physlib量纲归一] -> [公理守恒编译] -> [安全与注入扫描] -> [优先权存证上链]`
  当前选中的切片在各阶段点亮绿色微光节点。

### 3.4 双 Agent 以物易物谈判卡 (`BarterNegotiationCard.tsx`)
* **交互流程（专为 Shot 3 录像设计）**：
  - 左侧卡片：催化实验室 Agent 出价 1 份已编译的 OER LSV 切片；
  - 右侧卡片：电池实验室 Agent 响应提供 1 份快充衰减切片；
  - 中间连线呈现能量流动脉冲动画，显示双方正在进行机器级需求对齐与条件磋商；
  - 底部显示协商结果：`"Reciprocal Barter Terms Agreed. Awaiting Human PI Multi-Sig."`

### 3.5 人类 PI 私钥双签决策面板 (`HumanDualSignModal.tsx`)
* **交互流程（专为 Shot 4 录像设计）**：
  - 弹出全屏居中的半透明玻璃卡片；
  - 标题：`Executive Approval Card (Human-in-the-Loop Multi-Sig)`；
  - 摘要卡展示：双方切片的物理守恒合规报告、优先权哈希与零两用物项证明；
  - 两个醒目的私钥签名插槽：
    - `Agent Signature: [0x11aa...Verified ✓]`
    - `Human PI Signature: [Ready to Sign]`
  - 人类点击 **“Authorize & Sign with PI Key”**：
    - 触发密码学签发动画；
    - 两把对称密钥瞬间解密，完成原子对调，弹窗优雅关闭并提示：`Atomic Swap Executed Successfully`。

### 3.6 跨学科科学分析双图谱 (`DualDomainAnalytics.tsx`)
* **交互流程（专为 Shot 5 录像设计）**：
  - **左视窗（电催化分析）**：
    - 交互式 LSV 极化曲线（$V_{\text{RHE}}$ vs $j$）；
    - 动态标出电流密度 $10\text{ mA/cm}^2$ 处的过电位 $\eta_{10} = 240\text{ mV}$；
    - 拟合出 Tafel 动力学直线，标注斜率 $b = 42.5\text{ mV/dec}$，展现催化剂优异的高活性。
  - **右视窗（电池寿命分析）**：
    - 电池容量随循环周次衰减曲线，标出预估跳水拐点（Knee-point）；
    - 附带微分容量 $\frac{dQ}{dV}$ 瀑布图，标定活性物质损失特征。
  - **顶部黄色警示条（因果护栏）**：
    - `[CAUSAL GUARDRAIL ALERT]`：明确提醒研究人员：催化测试环境（碱性 1.0M KOH）与电池测试体系存在环境协变量偏移，严禁下游跨学科大模型做盲目因果混淆！

---

## 4. 离线演示备用机制 (Fail-Safe Mock Engine)

在 `frontend/src/lib/api_client.ts` 中配置环境变量：
* 当 `VITE_USE_MOCK=true` 时，无需后端启动，前端直接调用 `mock_data.ts`，确保录屏期间零延迟、零网络断联隐患。
* 当 `VITE_USE_MOCK=false` 时，调用 `http://localhost:8000/api/v1` 真实 FastAPI 接口。
