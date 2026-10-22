# SciExchange 视频环境

所有视频代码、依赖、浏览器、素材和输出均放在项目根目录的 `demo-video/`。
独立 npm 项目，不依赖或修改前端 pnpm lockfile、业务页面和后端。

当前状态：**3:49 英文 4K 成片已渲染并通过媒体规格检查；TTS 使用 GPT-SoVITS-v5turbo + Ace Taffy 参考语音。**
TTS 也已实测生成 3.16 秒、48 kHz 的中文合成语音，输出为 `public/generated/taffy-smoke.wav`。
TTS 安装、实际验证和使用方式见 [tts/README.md](tts/README.md)。旧高松灯 `.msvc` 的静态分析保留在 [MODEL_ANALYSIS.md](MODEL_ANALYSIS.md)，不参与新链路。

## 已安装

| 工具 | 版本 / 用途 |
| --- | --- |
| Node.js | 本机 v26.12.1，darwin arm64 |
| Playwright | 1.64.1，独立 Chromium 与录屏 FFmpeg |
| Remotion / CLI / renderer / bundler | 统一锁定 4.0.537 |
| React | 18.3.1 |
| FFmpeg / FFprobe | 本项目 Apple Silicon 二进制，实际版本 4.4 / n4.4.1 |
| Python | 本机 3.14.7，模型静态分析只用标准库 |

没有全局安装 FFmpeg，也没有修改系统 PATH、Python、Homebrew 或 shell 配置。
Remotion 使用自己的浏览器和媒体渲染组件。

## 常用命令

从仓库根目录进入：

```sh
cd demo-video
npm run doctor
npm run studio
```

Studio 地址：<http://localhost:3001>。入口为 `src/index.tsx`，测试合成
`EnvironmentCheck` 固定为 1920×1080、30 fps、3 秒。

```sh
# 只录制已经启动的本地页面；不会自动点击或执行审批操作。
npm run capture -- http://127.0.0.1:5173 5

# 用录制素材渲染环境测试合成。
npm run render -- render-props.example.json

# 自检使用独立的本地测试页与 440 Hz 测试音。
npm run smoke
npm run typecheck
npm test

# 项目内 FFmpeg / FFprobe，不依赖系统安装。
npm run ffmpeg -- -version
npm run ffprobe -- -v error -show_streams -show_format out/environment-check.mp4

# 静态模型分析；不运行模型，不上传文件。
npm run model:inspect
npm run model:probe
```

录制现有 SciExchange 时，请自行确认页面的 mock/live 模式；录制器不改变模式、
不重置数据库、不执行签名。录屏不包含浏览器页面声音；旁白作为独立音轨后期合成。
完整视频使用下方独立的 production 命令；上面的命令用于环境自检。

## OSI Hackathon 完整视频

当前版为 3:49（229 秒）、3840×2160、30 fps，包含实际应用 Demo、英文原速旁白和逐词同步英文字幕，保留团队开场白及 “Thank you for listening.” 结束语。
背景音乐改为用户提供的 MP3《桃の節句と艦娘》；使用 4 秒淡入、8 秒淡出与 4 秒循环交叉淡化。
音乐侧链压缩、语音频段均衡和轻声段落保护保持人声优先；检测到的语音窗口中，人声比背景音乐至少高约 18 dB。来源见 `assets/music/LICENSE.md`。
Demo 以 3840×2160 原生画幅重新录制，应用仅作显示缩放；Remotion 以 2 倍渲染比例输出矢量图形和文字。
场景时长由实际 TTS WAV 测量确定；不对旁白做加速、减速或时间拉伸。
演示使用应用现有的 mock adapter，持续显示模拟数据和审批标识；购买流程采用标明的独立新会话。

输出位于 `output/`：

- `SciExchange_OSI_Hackathon_2026.mp4`：完整视频。
- `subtitles.srt`：英文字幕。
- `thumbnail.png`：封面。
- `production-report.md`：来源、制作流程、验证结果及限制。
- `validation.json`：实际输出的媒体规格及自动检查结果。

从本目录运行，模型、参考语音与依赖需先按 `tts/README.md` 准备：

```sh
npm run video:narration
npm run video:captions
BGM_SOURCE="/path/to/music.mp3" npm run video:music

# 单独终端：读取原应用，仅将 Vite 缓存写入本目录。
VITE_DATA_MODE=mock node ../frontend/node_modules/vite/bin/vite.js --config automation/vite.config.mjs --configLoader native

# 应用在 5178 端口就绪后，在另一个终端执行。
npm run video:record -- --4k
npm run video:footage -- --4k
npm run typecheck
npm run video:stills
npm run video:render
npm run video:validate
```

正式入口为 `remotion/Root.tsx`。叙事、证据和逐场景时间线位于 `planning/`；
旁白脚本和字幕时间配置位于 `narration/`；原音测量、混音处理记录在本机生成并忽略。
字幕使用本地 Whisper 的强制对齐，逐场景核对脚本文字覆盖；并非独立转录对发音的认证。
`automation/record.ts` 在真实页面执行并验证 11 个场景，保留点击时间、状态检查和实际下载的 CSV。
未发布视频、创建公开社交帖子或提交比赛。

## 素材与输出

- `.local/models/高松灯/`：原压缩包解出的模型、图片和角色配置。
- `.local/analysis/`：文件哈希、模型结构和封装探测结果。
- `.local/browsers/`：Playwright 浏览器。
- `.local/npm-cache/`：npm 缓存。
- `node_modules/.remotion/`：Remotion 浏览器。
- `public/generated/capture.mp4`：经 FFmpeg 转换的录屏素材。
- `public/generated/smoke-tone.wav`：自检测试音，**不是高松灯语音**。
- `out/capture.webm`、`out/capture.png`：录制文件与截图。
- `out/environment-check.mp4`：自检合成，重复运行会覆盖这个输出。
- `out/smoke-result.json`：实际媒体参数和验证结果。

依赖、模型、素材、缓存与视频均由本目录 `.gitignore` 排除。请勿将大模型提交进 Git。
`render-props.example.json` 中的音频字段可指向 `public/` 内已经生成的旁白文件，
新配音使用 GPT-SoVITS-v5turbo，以数据集中的 Ace Taffy 音频作为零样本参考。

```sh
npm run tts:progress
npm run tts:doctor
npm run tts:smoke
npm run tts:synthesize -- --text "欢迎了解我们的科学数据交换平台。"
```

## 换机重建

```sh
cd demo-video
npm ci
npm run setup:browsers
npm run typecheck
npm test
npm run smoke
```

Git 仅包含源码、脚本、依赖锁文件、制作说明和必要的文本配置；不包含成片、录屏、音频、模型、依赖、缓存及生成报告。上述成片规格描述的是本机历史制作结果，克隆仓库不会获得成片，也不代表新环境已通过媒体验证。

`narration/captions.json` 保存当前剪辑所需的逐词字幕时间配置，重新运行 `video:captions` 会更新它。`planning/timeline.json` 和 `planning/recording-manifest.json` 保存当前剪辑的场景及片段配置，后者会在重新准备录屏素材时更新。两者引用的媒体均需另行生成。

完整制作还需运行 `npm run tts:setup`，在该 Python 环境安装 `narration/requirements-production.lock.txt` 中的依赖，并单独准备 `.local/whisper/tiny.en.pt`。背景音乐可通过 `BGM_SOURCE` 指定，或放到 `.local/music/supplied-bgm.mp3`；历史乐谱脚本可通过 `SCORE_SOURCE` 指定图片。音频、乐谱和模型文件均不随源码分发。TTS 和混音脚本目前按本机 macOS / Apple Silicon 环境配置，其他平台需要适配媒体二进制路径。

旧模型静态分析需要从原始压缩包单独解到 `.local/models/`。解压包中的配置只作为
数据读取，不作为安装指令执行。完整版本锁定见 `package-lock.json`。

参考：[Playwright 浏览器安装](https://playwright.dev/docs/browsers)、
[Playwright 录屏](https://playwright.dev/docs/videos)、
[Remotion 安装](https://www.remotion.dev/docs/)、
[Remotion 渲染 API](https://www.remotion.dev/docs/renderer/render-media)。
