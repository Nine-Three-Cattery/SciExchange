# GPT-SoVITS-v5 / Ace Taffy

本目录配置官方 **GPT-SoVITS-v5turbo** 零样本中文推理。声音参考来自用户指定的
[KYOU-0/Ace-Taffy-voice 第 18 页](https://huggingface.co/datasets/KYOU-0/Ace-Taffy-voice/viewer/default/train?p=18)，
实际身份标记为“永雏塔菲 / Ace Taffy”。旧的高松灯 `.msvc` 不参与这条链路。

没有微调或训练；生成语音应视为合成内容，声音相似度需要试听。

已执行验证：全部 12 个资源文件完整；模型与数据按固定校验值核对。
中文测试句成功生成 `public/generated/taffy-smoke.wav`，3.16 秒、48 kHz、单声道
PCM 16-bit、非静音。本机 CPU 上该次模型加载及合成耗时 6.51 秒。
这些检查不等同于语音识别准确率或主观音色质量评估。

## 使用

以下命令在 `demo-video/` 内运行：

```sh
npm run tts:progress
npm run tts:doctor
npm run tts:smoke

npm run tts:synthesize -- --text "欢迎了解我们的科学数据交换平台。" --output public/generated/narration.wav
# 较长文稿建议拆成多个场景分别生成。
npm run tts:synthesize -- --text-file narration.txt --output public/generated/narration.wav

# 英文合成，保留同一中文参考音色。
npm run tts:synthesize -- --language en --text "Every great discovery begins with a simple question." --output public/generated/english.wav

# 可选：启动官方 API，只绑定本机 127.0.0.1:9880。
npm run tts:serve
```

默认中文 `all_zh`、CPU、FP32、4 步 v5turbo、关闭 CUDA Graph 和 Flash Attention。
已实测英文跨语言合成；没有测试 CUDA、MPS、日文或训练功能。
本次是推理所需依赖子集，未安装官方完整 ASR、UVR 和训练工具链。

生成 WAV 放在 `public/generated/`，可将 Remotion props 的 `audio` 字段设为
`generated/narration.wav`。当前环境测试视频仅 3 秒，制作正式旁白时需要相应调整合成时长。
每份合成结果附带 JSON，记录引擎、原文、声音来源、参考片段、随机种子和校验值。
该元数据中的耗时包含模型加载；不代表 API 服务预热后的推理速度。

英文例子 `public/generated/taffy-english-10s.wav` 已验证为精确 10.00 秒、48 kHz、
单声道 PCM。原始模型输出 7.16 秒，使用 FFmpeg `atempo=0.716` 保持音高减速至
10 秒；原始音频和处理参数均保留。英文发音额外预置 NLTK CMU 词典及新旧词性标注资源，
下载校验值和解压位置已纳入 `assets.lock.json`。

## 文件布局

| 路径 | 内容 |
| --- | --- |
| `tts/GPT-SoVITS/` | 官方上游源码及其预训练模型，已由父目录忽略 |
| `tts/assets.lock.json` | 上游提交、模型/数据修订、下载 URL、大小和大文件 SHA-256 |
| `tts/requirements.lock.txt` | 实际 Python 推理环境的精确版本 |
| `.local/python/` | 项目内 Python 3.11.17 |
| `.local/tts-venv/` | 独立虚拟环境，PyTorch/torchaudio 2.7.0 |
| `.local/tts-downloads/` | G2PW 压缩包与原始 Parquet 分片 |
| `.local/tts-ranges/` | 下载续传分段；进度统计避免重复计算 |
| `.local/voices/ace-taffy/` | WAV、原始 WAV、转录、参考来源清单和 `.list` |
| `.local/tts-infer.yaml` | 自动生成的本机绝对路径配置 |

参考片段为固定数据修订的第 1804 行（从 0 起算）、`segment_id=001805`，
选取完整短句作为参考，并核对时长、有限样本和非静音条件。
参考 WAV 保留数据集采样率；模型内部重采样不会恢复原素材缺失的高频信息。
数据集元数据声明许可为 MIT，来源和修订均保存在参考清单中。

## 重建与适配

```sh
npm ci
npm run tts:setup
npm run tts:smoke
```

安装器将 Python、uv、依赖、模型和缓存放在 `demo-video/`，不修改系统 Python、
Homebrew、shell PATH 或项目外的业务代码。大文件使用有界 HTTP Range 重试，完成后
按固定 SHA-256 校验；网络传输的 100% 与最终校验成功分别看待。
现有上游源码版本不一致时保留原目录并报错，不覆盖本地修改。

该上游提交的 portable runtime 默认引用 Windows 的 `runtime/ffmpeg.exe`。
本地 `runtime.py` 在导入 TTS 前将这两个模块常量指向现有的 Apple Silicon
FFmpeg/FFprobe；未修改上游实现。启动会把工作目录切到上游，缓存仍留在本项目内。
本地 API 已实测启动，`GET /openapi.json` 返回 200，并包含 `POST /tts`；验证后服务已停止。

中文多音字使用官方 G2PW ONNX 模型。配置成功后推理设为离线模式，缺失资源时应报错，
不会静默更换语音模型或落回测试音。
文本分段还预置了官方 fastText `lid.176.bin`，按 fast-langdetect 内置 MD5
及本地锁定的 SHA-256 核对，避免首次合成隐式下载。

官方参考：[v5 发布与安装说明](https://github.com/RVC-Boss/GPT-SoVITS/blob/main/docs/cn/README.md)、
[模型仓库](https://huggingface.co/lj1995/GPT-SoVITS)、
[数据集](https://huggingface.co/datasets/KYOU-0/Ace-Taffy-voice)。
