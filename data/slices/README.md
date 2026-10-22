# 演示科学切片与来源

这里有 **7 个真实实验衍生切片 + 1 个明确标记的合成故障切片**。它们是可检查的小样本，不代表覆盖全部材料体系或已经完成科学准入审核。

| slice_id | 内容 | 数量/范围 |
|---|---|---|
| `catalysis_nifec_lsv` | NiFeC LDH，M1 极化曲线 | 原始 Ag/AgCl 电位、电流及溶液电阻 |
| `catalysis_nifec_tafel` | 同体系稳态阶跃 | 9 个电位阶跃，末 25 点均值 |
| `battery_b1c5_early` | Severson batch 1 cell 5 循环摘要 | cycle 2–100，99 行 |
| `battery_b1c5_lifetime` | 同电芯完整观测循环摘要 | cycle 2–1073，1072 行 |
| `battery_b1c5_cycle_10` / `_50` / `_100` | 作者预插值的放电 Q(V) 内部窗口 | 约 2.3–3.3 V，分别保留来源循环标签 |
| `synthetic_fault_injection` | FE=108.2% 声明、注入文本和化学名称复核样例 | 纯合成，勿称真实实验室造假案例 |

## 来源、许可和修改

**催化：** Berger, M.; Popa, I. M.; Negahdar, L.; Palkovits, S.; Kaufmann, B.; Pilaski, M.; Hoster, H.; Palkovits, R. (2023), *Dataset for the publication: Elucidating the influence of intercalated anions in NiFe LDH on the electrocatalytic behavior of OER: a kinetic study*, [Zenodo, DOI 10.5281/zenodo.8031660](https://zenodo.org/records/8031660), version 1，CC BY 4.0。许可 ID 由源站 API 的 `metadata.license.id=cc-by-4.0` 核对；文件 MD5 与源站列表一致。

- `sources/Figure 3.csv` 和 `Figure 4.csv` 是未修改的来源文件，编码 CP1252、分号分隔。派生文件用 UTF-8、逗号分隔。
- 使用 NiFeC LDH 的 M1，不混合不同插层阴离子或重复实验。GC-RDE 直径 4 mm，几何面积 π×0.2² cm²。
- 稳态值按源文件备注取每阶跃末 25 点平均，并用 `E_applied−I×Ru` 形成带明确假设的修正值；LSV 保留原表电位，不再次补偿。
- LSV 原表含去程和回扫（292 次正向、288 次反向电位步进），元数据明确标记；需要先切出单个分支并记录转换后才能做 Tafel 拟合，不混合两段给出单一斜率。
- 源表把电解液写成 `1 M KOH (pH 16.67)`，本项目保留该记录并标记待核，未转换成 RHE，未宣称 η10 或 FE。
- **不是 OC22 数据。** 选用这个来源是因为本轮需要真实实验极化与稳态数据，而不是用计算数据冒充实验曲线。

**电池：** Severson, K. A., et al. (2019), *Data-driven prediction of battery cycle life before capacity degradation*, *Nature Energy* 4, 383–391, [DOI 10.1038/s41560-019-0356-8](https://doi.org/10.1038/s41560-019-0356-8)。[TRI 数据目录](https://data.matr.io/)将这个具体数据集标为 **CC BY 4.0**；其他 TRI 数据集可能采用不同许可，不可混用判断。[作者代码与数据说明](https://github.com/rdbraatz/data-driven-prediction-of-battery-cycle-life-before-capacity-degradation)提供 batch/cell 字段解释。

- 从原始 `2017-05-12_batchdata_updated_struct_errorcorrect.mat` 的 batch 索引 5 提取 b1c5。所用协议字符串直接读自原文件：`4.4C(80%)-4.4C`，LFP/graphite。
- 用 HTTP Range 读取所需 HDF5 对象，未下载整个 3,025,320,241 字节文件；因此 **整文件 SHA-256 未计算**。保留的来源摘录和所有派生文件均有本地 SHA-256。
- 提取脚本另外校验所用 8 个数组的固定规范化摘要，基线来自两次已核对的独立提取，绑定来源、cell、协议和提取版本。更改缓存内容后不能直接重建带原始来源声明的切片；这项校验仍不等于原始完整文件哈希或真实性证明。
- `sources/severson_b1c5_summary.csv` 包含原始零值 cycle 1；分析切片排除此行，明确记录 `excluded_cycles=[1]`。不把 cycle 2 重编号为 1。
- `sources/severson_b1c5_qdlin_*.csv` 保留完整作者插值 Qdlin/Vdlin。小幅负端点容量和 cycle 10/50 的局部反向增量也保留。用于 dQ/dV 的派生切片统一取 2.3–3.3 V 内部窗口，不做容量裁零或单调回归；这个选择不能用于声称全电压范围特征。
- summary 的 `average_temperature_c` 是每周期温度；30°C 是实验箱设定值，不能替代所有观测的实际温度。通用 `temperature_c` 留空。

上述真实来源与派生数据按 [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) 提供，保留作者署名、来源与修改说明；不暗示原作者认可本平台。代码与本项目合成故障输入按仓库 Apache-2.0 许可。真实实验数据不因放在本仓库而变成 Apache-2.0。

## 文件完整性与复现

`manifest.json` 列出元数据文件与来源文件 SHA-256；各元数据 JSON 再绑定 CSV 哈希、列名、行数和转换说明。它们只能发现相对于可信 manifest 的字节变化，**不是签名，也不独立证明数据真实性或许可权利**。

使用 `backend/scripts/prepare_science_data.py --fetch` 重新提取，或直接运行仓库中的离线切片；详见 [B 接入说明](../../docs/B_SCIENCE_HANDOFF.md)。CSV 中的列单位在对应 JSON 的 `metadata.units` 声明，分析接口拒绝单位未知或混用的输入。
