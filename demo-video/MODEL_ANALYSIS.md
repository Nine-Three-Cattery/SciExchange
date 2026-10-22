# 高松灯 .msvc 静态逆向分析

这是旧 `.msvc` 文件的分析记录。当前配音链路已改用 GPT-SoVITS-v5turbo 与用户指定的
Ace Taffy 数据集参考语音，并已实测合成成功；参见 [TTS 配置](tts/README.md)。

## 结论

文件高度符合 **RVC v2、40 kHz、带基频条件的语音转换模型**的元数据结构。
它把权重封装为字符串，当前不能直接作为标准 RVC 或 GPT-SoVITS 模型加载。
**尚未解出张量权重，没有完成推理，也没有生成高松灯配音。**

即使成功恢复 RVC 权重，配音路线也应是“文本 → 基础 TTS/人声 → RVC 音色转换”，
不能仅凭这个文件直接从文字生成语音。当前没有安装一个无法使用该文件的 TTS 大环境。

## 本地证据

原包 `高松灯(1).7z` 包含 `config.json`、`gsd.jpg` 和 `高松灯.msvc`，没有推理程序、
README、模型索引或解封装实现。角色配置声明名称“高松灯”、类型“二次元角色”、
`pitch=12`；这只是原软件的参数，未经试听验证，不作为自动移调设置。

| 项目 | 观察结果 |
| --- | --- |
| 模型大小 | 109,547,804 字节 |
| SHA-256 | `6aaea2480a1f799e823d95f5d4703695e88a0144bfc0a6cfb53a7356204f7b92` |
| 外层格式 | PyTorch legacy 序列化；pickle protocol 2、内部协议 1001 |
| 顶层字段 | `weight`, `config`, `info`, `sr`, `f0`, `version`, `mdcf` |
| 采样率与版本 | `sr=40k`, `f0=1`, `version=v2` |
| 架构配置 | 与 RVC 官方 `savee()` 的 40 kHz 配置序列一致 |
| `weight` | 109,547,114 字符的字符串，非 state_dict |
| `mdcf` | 254 字符的附加字符串，语义未确认 |
| 张量存储列表 | 空；外层文件没有可直接读取的张量存储 |
| 文件尾附加数据 | 0 字节 |

RVC 官方的[模型导出实现](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/blob/main/train/process_ckpt.py)
将 `weight` 写为张量字典，并记录 `config/sr/f0/version`；
[推理实现](https://github.com/RVC-Project/Retrieval-based-Voice-Conversion-WebUI/blob/main/infer/rtrvc.py)
会访问 `weight["emb_g.weight"]`。本文件的 `weight` 是字符串，无法满足该读取方式。
因此“RVC 系封装模型”有结构依据，但具体软件厂商仍不能由此确认。

## 封装分析

`weight` 与 `mdcf` 均可按“2 字符前缀 + Base64 + 16 字符后缀”拆分。
Base64 严格校验通过后，分别得到 **82,160,320** 与 **176** 字节，都是 16 字节的整数倍。
大载荷首 1 MiB 的字节熵约 **7.99978 bit/byte**，没有识别到 ZIP、pickle、gzip 或 JSON 文件头。

这些特征与加密/混淆载荷相容；**不能仅凭高熵和块对齐确认 AES、密码模式或密钥派生方法**。
16 字符后缀也不能直接认定为密钥。

在已存在的 16 字符字段及其反转、MD5/SHA256 变体范围内，做了 408 个有限 AES
ECB/CBC/CTR/CFB/OFB 候选组合测试，未得到可识别的常见明文文件头。
该结果只排除这批简单组合；不证明加密不可恢复，也不证明某种密码方案存在。
没有运行任意密码搜索，没有执行模型或下载未知加载器。

## 复现与边界

```sh
npm run model:inspect
npm run model:probe
npm test
```

分析器只解释有限的 pickle 字面量操作码；`collections.OrderedDict` 以内部字典标记处理，
不调用原类构造函数，其他全局对象、函数调用与持久化存储引用均拒绝。
不会调用 `pickle.load()`、`torch.load()` 或 `eval()`。
本地 JSON 报告在 `.local/analysis/`；原始模型未被更改或上传。

进一步恢复所需的证据是原软件加载/导出程序、对应源码、格式说明，或同一音色的标准
RVC `.pth`/ONNX 权重。若改用 GPT-SoVITS，则需要对应的 GPT/SoVITS 权重和参考音频，
它们不是把 `.msvc` 改扩展名就能得到的。当前已知文件不足以确认解封装算法或完成 Mac 推理。
