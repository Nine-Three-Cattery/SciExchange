# SciExchange 简化检索

按「先框架、后电池数据」收集候选，供人工阅读和小规模试用。Python 3.10+，仅使用标准库；不需要 API Key 或 LLM 服务。

团队阅读入口：[候选架构与数据调研](../../docs/research/README.md)。本工具是离线研究准备流程；不执行交易、物理检查或实验数据导入。

## 复用范围

从 SFM 文献挖掘包提取查询生成、arXiv／Crossref 解析、身份归一和保守去重，共 6 个原实现模块。文件逐字节保留，版本和 SHA-256 见 `vendor/UPSTREAM.json`，MIT 许可证见 `vendor/LICENSE.SFMSafeLens`。精简的 `__init__.py` 只导出需要的模块。原 SFM 项目无需修改，运行也不依赖它的本地路径。

保留关键词 → 平台查询 → 原始响应 → 归一去重 → 候选清单。SFM 专用模型字段、全文抽取、LLM 执行、知识图谱、谱系关系和多轮发布流程未带入。新增 GitHub／Zenodo 元数据适配器；Crossref 使用普通排序查询，不将 arXiv 布尔式误传给它。SFM 的 `dataset_tool` 是兼容的技术分类，两轮实际主题由配置与运行清单区分。

## 使用

在仓库根目录运行，输出目录必须是新目录：

```sh
# 离线检查第一轮查询
python3 scripts/research/mine.py plan --phase frameworks --out .cache/research/framework_plan

# 第一轮：相近系统、论文、GitHub 项目
python3 scripts/research/mine.py run --phase frameworks --limit 8 --out .cache/research/frameworks --allow-network

# 阅读第一轮，再跑第二轮：电池实验数据、原论文与处理工具
python3 scripts/research/mine.py run --phase battery_data --limit 8 --out .cache/research/battery_data --allow-network

# 不联网重放；config、phase、limit 必须与原运行一致
python3 scripts/research/mine.py run --phase frameworks --limit 8 --config .cache/research/frameworks/keywords.json --replay .cache/research/frameworks --out .cache/research/frameworks_replay

# 验证提取后的关键行为
python3 -m unittest discover -s scripts/research -p 'test_*.py' -v
```

修改 `keywords.json` 中的 `terms`／`required` 调整 arXiv 查询；`crossref` 是该主题的普通文本排序查询。`github_queries` 与 `zenodo_queries` 使用对应服务语法。`*_seeds` 是前期已知线索的定向核验，不算搜索新发现。每条搜索只取第一批，默认 8 条、上限 30 条；命中数与实际取得数量分别记录。

## 产物和边界

- `queries.json`：实际 URL、关键词、平台、search／seed 模式。
- `raw/`、`requests.json`：原始元数据响应、时间、SHA-256、总命中数、截断、API 不完整标记和错误；失败不伪装成零命中。
- `candidates.jsonl`、`identity_reviews.json`：合并后的候选与全部来源观察；身份冲突保留待查。
- `report.md`：按类型排列的阅读清单，词面匹配分数只用于排序。
- `run_manifest.json`：代码与配置哈希、SFM 版本、数量和运行状态。

返回码 0 表示本批请求和解析完成；2 表示有失败或服务声明结果不完整。即使 `complete`，也只代表限量元数据流程完成，不代表系统综述、全文核验、代码运行成功、数据许可批准或实验数据入库。离线重放会重现原失败，校验成功响应的哈希；不会偷偷补联网。

仓库发布的是简化元数据、阅读清单和运行摘要，未发布 `.cache` 原始响应。`--replay` 需要已有完整运行目录；新 clone 可用上述联网命令建立自己的缓存，或直接运行不联网的单元测试。重新查询在线 API 不保证与历史候选逐字节相同。

GitHub 的 license 字段只是 API 元数据；选用代码前阅读 LICENSE。Zenodo 保存数据许可、文件目录、校验和与版本关联，但不下载实验文件。论文的开放许可不能替代配套数据许可。后续数据筛选再核对老化温度／测量温度、循环定义、单位、电芯身份与作者勘误。

接口依据：[Crossref](https://www.crossref.org/documentation/retrieve-metadata/rest-api/)、[GitHub Search](https://docs.github.com/en/rest/search/search#search-repositories)、[Zenodo](https://developers.zenodo.org/)。联网访问限于四个公开 API 主机；有超时、响应体大小上限和按主机的请求间隔。
