# B 数据接入与运行

接入分支：`codex/b-data-integration`。基于 A/C 接线 `23272de` 合并 B 科学模块 `435806d`，使用同一个 FastAPI 入口、SQLite 数据库和前端。

## 已完成

- 启动时校验 manifest、CSV、元数据和来源摘录，导入 **8 个科学切片：7 个实验来源、1 个合成故障**；另保留 5 个旧合成基准。失败整批回滚，重复导入不重复建记录。
- 加密保存原始 payload，保留来源、CC-BY-4.0、单位、空温度及显式版本。同一个 slice_id 不允许换内容或版本，修订使用新 ID。
- `science_records` 存当前检查报告；`science_admissions` 保存 PI 签名与当时完整报告。签名绑定数据版本、内容摘要、规则版本和报告摘要。规则或报告变化后旧准入失效，历史证据保留。
- 7 个真实切片初始均为 `REVIEW_REQUIRED`、未准入。PI 准入后可交换，但科学检查仍为 `REVIEW_REQUIRED`、`valid=false`、`formal_proof=false`。合成故障保持隔离。
- 接通双 PI 交换、授权下载与分析。下载和分析读取同一份经过内容摘要核对的原始数据；科学分析必须带版本。前端按切片能力选择方法，保留未知指标和导数符号。

`lab_catalysis` / `lab_battery` 是本地演示保管身份，不代表数据作者或真实来源机构签署了许可、审核或交换。源数据的许可与署名要求仍然适用。

## 启动

从本分支的仓库根目录执行，使用 Python 3.11：

```bash
python3.11 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt -r backend/requirements-science.txt
.venv/bin/python scripts/setup_demo.py
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

数据已随仓库提供；启动会创建数据库并导入，不需要重新下载来源数据或手工执行 SQL。数据库、存储密钥、演示客户端密钥位于忽略提交的 `.sciexchange/`，重启保留。不要把不同数据库的密钥混用。

另开终端，在 `frontend/` 中执行（Node.js 22+、pnpm）：

```bash
pnpm install --frozen-lockfile
VITE_DATA_MODE=live VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1 pnpm dev
```

打开 `http://127.0.0.1:5173`。PI 签名弹窗只接收签名，不上传私钥；本地签名命令见[前端指南](../frontend/README.md#signing-without-transmitting-private-keys)。

## 演示顺序

1. 选择 `lab_catalysis`，检查 `catalysis_nifec_tafel`，查看缺失条件后签署准入。
2. 切换 `lab_battery`，对 `battery_b1c5_early` 检查并签署准入。
3. 在交换面板选择这两个切片，生成提议；分别完成两位 PI 的交换签名。单签时不能交付对方数据。
4. 交付后进入分析：Tafel 使用 0.3–10 mA/cm²，结果约 **76.11 mV/dec**；保留 Ag/AgCl 参比，η10 显示未计算。早期电池窗口不显示虚构的膝点。
5. 可另对 `battery_b1c5_cycle_10` 准入并由保管者授权读取，查看带负号的放电 dQ/dV。`synthetic_fault_injection` 用于演示拒绝与隔离。

准入签名与交换签名是不同操作：前者允许一份数据参与平台交换，后者授权具体双方交付。浏览器测试使用临时演示密钥自动签名，只验证协议与界面行为，不代表真实 PI 已审核数据。

## 当前接口

| 端点（统一前缀 `/api/v1`） | 科学切片行为 |
|---|---|
| `GET /slices` | 返回版本、科学状态、独立准入状态、可用分析方法和来源 |
| `POST /compiler/verify` | 已导入 `slice_id`，可带 `version`；重算检查，不自动准入 |
| `POST /compiler/review-challenge` | `slice_id`、`version`，返回有时限的签名消息 |
| `POST /compiler/review` | 加上 `signer_address`、`signature`、`expires_at`，验证所属 PI 签名 |
| `POST /barter/negotiate`、`/barter/dual-sign` | 沿用已有双签交易协议 |
| `GET /slices/{id}/download` | 沿用已有授权；可用 `format=json&version=1` 核对版本，返回原始 payload |
| `POST /analysis` | 必填 `slice_id`、`version`、`analysis_type`，可带 `parameters`；同下载授权 |

催化稳态切片支持 `tafel_slope`；循环摘要支持 `capacity_fade`、`knee_point`；单周期 Q(V) 支持 `dq_dv`。含回扫的 LSV 暂不提供 Tafel 分析。科学规则、拟合假设和来源限制见 [B 科学说明](B_SCIENCE_HANDOFF.md)。

B 原独立路由保留用于模块测试，未挂载到主应用。主应用使用上表端点，不使用 `/analysis/catalysis` 或 `/analysis/battery`，也不继承独立路由的 `ScienceJSONRoute` 请求体保护。

## 验证

```bash
.venv/bin/python -m pytest --import-mode=importlib tests backend/tests -q
.venv/bin/python -m pytest scripts/research/test_mine.py -q
PYTHONPATH=. .venv/bin/python backend/scripts/run_science_demo.py
cd frontend
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e:live
pnpm test:e2e:science
```

本轮结果：后端与科学模块 **341 passed**；文献挖掘 **9 passed**；前端单元 **113 passed**；真实科学浏览器流程 **1 passed**；旧 live 浏览器流程 **3 passed、1 skipped**（移动端不重复完整交换流程）。类型检查、lint、构建通过；科学图已检查。后端有一条 Starlette/httpx 测试客户端弃用提示。

新增回归覆盖：原文与版本保留、失败导入回滚、重复导入/重启、签名冒用/篡改/过期、隔离拒绝、双签前后权限、错误版本、内容篡改、规则更新撤销准入及历史签名保存。浏览器流程使用真实 FastAPI 与隔离 SQLite，不模拟 HTTP 成功响应。

当前完成的是本地网关演示。科学模块提供有限一致性检查和参考分析；身份是本地注册密钥，结算沿用本地 SciCredit。未验证真实实验室接入、生产部署、外部支付、科学真实性或法律优先权，也未实现 Lean 证明、LLM 自主谈判或因果识别。
