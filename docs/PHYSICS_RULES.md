# SciExchange — 物理与化学守恒公理集 (Physics & Safety Guardrail Rules)

**文档责任人：** Shaokang (Member B - 物理形式化编译、化学安全与科学智能)  
**理论体系：** “科学界的 Lean 4” 公理化约束求解与两用安全守门  
**版本状态：** 规则完全冻结 (v4.0 Frozen)

---

## 1. 物理形式化编译核心理念 (Lean 4 for Science)

在传统科学计算中，数据往往被视作纯粹的张量（Floats / Matrices），任何违反物理定律的脏数据、造假数据（如过度拟合、平滑抹去尖峰、法拉第效率超 100%）都能直接输入神经网络，造成 AI 幻觉和灾难性泛化。

SciExchange 物理编译器（`physics_compiler.py`）将实验数据作为**待证明的命题 (Theorem)**，以**第一性原理物理不变量为公理 (Axioms)**。只有当数据满足全部公理约束时，才签发 `Verified Attestation`。

---

## 2. 领域一：电催化析氧反应 (Electrocatalysis OER) 公理体系

基准参照：Meta FAIR Open Catalyst Project 2022 (OC22) & 真实 NiFe-LDH 催化体系。

### 公理 1：电荷守恒与法拉第效率上限 (Faradaic Efficiency Conservation)
* **形式化命题：** 对于析氧反应（$2\text{H}_2\text{O} \to \text{O}_2 + 4\text{H}^+ + 4e^-$，电子转移数 $z=4$）：
  $$\text{FE} = \frac{z \cdot n_{\text{observed}} \cdot F}{Q_{\text{total}}} \times 100\% \le 100.0\%$$
* **判定阈值：**
  - $\text{FE} \in [0.0\%, 100.0\%]$ $\implies$ **PASS**
  - $\text{FE} > 100.0\%$ $\implies$ **REJECT (CRITICAL_FRAUD / Violation of 1st Law of Thermodynamics)**
  - 容差：考虑色谱检测微小系统误差，上限可设至 $100.5\%$；超过此值一律判定为造假或严重电极副反应未扣除。

### 公理 2：热力学可逆平衡电位与过电位下限 (Thermodynamic Overpotential Lower Bound)
* **形式化命题：** 在标准工况（$T=298.15\text{ K}, P=1\text{ atm}, \text{pH}=14$）下，OER 的热力学平衡电位 $E^0 = 1.230\text{ V vs. RHE}$。
  $$\eta = E_{\text{RHE}} - E^0 \ge 0$$
* **判定阈值：**
  - 当 $j \ge 10\text{ mA/cm}^2$ 时，任何常温常压催化剂的理论过电位必有 $\eta_{10} > 0$（现代最优催化剂极限通常在 $150\text{ mV} \sim 250\text{ mV}$）。
  - 若数据声称在 $E_{\text{RHE}} < 1.23\text{ V}$ 下发生自发净析氧电流（$j > 0.5\text{ mA/cm}^2$），违反热力学第二定律，直接驳回。

### 公理 3：微观动力学线性 Tafel 区间一致性 (Tafel Slope Consistency)
* **形式化命题：** 在动力学控制区（$1 \le j \le 10\text{ mA/cm}^2$），过电位与电流密度对数满足 Butler-Volmer 近似方程：
  $$\eta = a + b \log_{10}(j), \quad b = \frac{2.303 RT}{\alpha F}$$
* **判定阈值：**
  - 拟合判定系数 $R^2 \ge 0.98$。
  - 合理 Tafel 斜率范围 $b \in [25.0, 250.0]\text{ mV/dec}$。
  - 若 $b < 20.0\text{ mV/dec}$，在水系电催化体系中若无超导或非拉法第效应，判为仪器伪影或造假外推。

### 护栏 4：实验仪器与人为操作噪声隔离 (Instrument Noise Guardrail)
* **未补偿溶液阻抗 ($R_u$)：**
  $$E_{\text{corr}} = E_{\text{meas}} - I \cdot R_u$$
  - 若 $R_u > 15.0\,\Omega$ 且未做至少 $85\%$ 的动态 $iR$ 补偿，判定为“实验操作缺陷（OPERATOR_ERROR_UNCOMPENSATED）”，警告提示其失真。
* **开路电压漂移 (OCV Drift)：** 测量前 60s 漂移需 $\le 5.0\text{ mV}$，否则视为参比电极毒化。

---

## 3. 领域二：锂电池快充衰减循环 (Battery Fast-Charging) 公理体系

基准参照：Stanford / MIT / Toyota 电池寿命预测基准 (Severson et al. 2019, *Nature Energy*)。

### 公理 1：库伦效率守恒 (Coulombic Efficiency Ceiling)
* **形式化命题：** 放电容量不得超出充电容量：
  $$\text{CE} = \frac{Q_{\text{discharge}}}{Q_{\text{charge}}} \times 100\% \le 100.0\%$$
* **判定阈值：** 商业 LFP/NMC 正常循环区间为 $99.5\% \sim 99.98\%$。若 $\text{CE} > 100.0\%$，判定违反电荷守恒。

### 公理 2：微分容量 ($dQ/dV$) 导数单调性与相变指纹
* **形式化命题：** 恒流充电阶段，端电压随时间单调递增（$dV/dt > 0$）。
  $$dQ/dV = \frac{I \cdot dt}{dV} > 0$$
* **判定阈值：**
  - $dQ/dV$ 必须在平滑后保持正定；
  - 峰值对应脱嵌锂相变平台（LFP 典型相变峰位于 $3.40\text{ V} \sim 3.45\text{ V}$）。若相变峰消失或出现剧烈负尖峰，判定为接触不良或采样异常。

### 公理 3：热力学第二定律之容量衰减非负性
* **形式化命题：** 在无外部化学补锂的密闭电芯中，活性锂损失是不可逆的热力学自发耗散：
  $$\frac{dQ_{\text{discharge}}}{dN} \le 0 \quad (\text{长周期宏观趋势})$$
* **判定阈值：** 允许单周小幅温度波动（$\Delta Q < 1\%$），但 10 周滑动平均严禁出现容量自发持续逆增长。

---

## 4. 化学安全与对抗防御守门人 (Safety & Security Guardrails)

实现文件：`safety_guardrail.py`

### 4.1 禁止性化学武器公约 (CWC) 两用物项审查
切片元数据与成分描述严禁包含禁止化合物（Schedule 1 / Schedule 2）：
* 神经性毒剂：Sarin (GB), Soman (GD), Tabun (GA), VX, Novichok (A-230/A-232/A-234)
* 糜烂性毒剂：Sulfur Mustard (HD), Nitrogen Mustard (HN-1/2/3), Lewisite
* 强毒生物毒素：Ricin, Saxitoxin
* **处理逻辑：** 一旦命中 CAS 编号或分子式关键词，立即触发系统最高级红色告警 `CRITICAL_CWC_VIOLATION`，并在数据库中隔离不可见。

### 4.2 间接提示词注入 (Indirect Prompt Injection) 隔离沙箱
科学切片的实验备注 (Notes) 经常被上游 Agent 自动读取。恶意攻击者可能在备注中嵌入越狱 Prompt：
* **拦截正则：**
  - `(?i)(ignore\s+previous\s+instructions|system\s+instruction:|as\s+an\s+unfiltered\s+ai|exfiltrate|api_key|secret_key)`
* **处理逻辑：** 检测到匹配项时，将文本字段进行转义并打上 `[QUARANTINED_UNTRUSTED_CONTENT]` 标记，阻断对下游智能体的上下文污染。

---

## 5. 核心参考文献与理论依据 (Literature Grounding)

1. **电催化活性评估与造假/误差审查：**
   - S. Anantharaj et al., *"Precision and correctness in the evaluation of electrocatalytic water splitting: revisiting activity parameters with a critical assessment"*, **Energy & Environmental Science**, 11, 744–771 (2018). [DOI: 10.1039/C7EE03457A](https://doi.org/10.1039/C7EE03457A). *(奠定了本规范对 Tafel 斜率虚假线性区、未做 iR 补偿及超 100% 法拉第效率的公理判定)*
2. **Meta FAIR 氧化物电催化基准：**
   - R. Tran et al., *"The Open Catalyst 2022 (OC22) Dataset and Challenges for Oxide Electrocatalysts"*, **ACS Catalysis**, 12, 14068–14084 (2022). [DOI: 10.1021/acscatal.2c05426](https://doi.org/10.1021/acscatal.2c05426). *(提供 NiFe-LDH 催化切片黄金基准)*
3. **锂电池快充寿命与 dQ/dV 相变分析：**
   - K. A. Severson et al., *"Data-driven prediction of battery cycle life before capacity degradation"*, **Nature Energy**, 4, 383–391 (2019). [DOI: 10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8). *(提供电池快充 100 周容量衰减与库伦效率守恒基准)*
4. **两用物项与生成式 AI 化学安全防御：**
   - F. Urbina et al., *"Dual use of artificial-intelligence-powered drug discovery"*, **Nature Machine Intelligence**, 4, 189–191 (2022). [DOI: 10.1038/s42256-022-00465-9](https://doi.org/10.1038/s42256-022-00465-9). *(论证了 AI 自动化化学合成中强制嵌入 CWC 神经毒剂审查的必要性)*

