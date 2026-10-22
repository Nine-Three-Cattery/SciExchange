#!/usr/bin/env python3
"""复用 SFM 查询、解析、去重；只收集公开元数据，不下载论文或实验数据。"""
from __future__ import annotations

import argparse
import hashlib
import json
import platform
import re
import sys
import time
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import HTTPRedirectHandler, Request, build_opener

from vendor.sfm_lite.query_builder import KeywordRow, build_queries
from vendor.sfm_lite.sources.common import RawCandidate, SourceQuery, strip_markup
from vendor.sfm_lite.sources.arxiv import ArxivAdapter
from vendor.sfm_lite.sources.crossref import CrossrefAdapter
from vendor.sfm_lite.candidates.deduplication import deduplicate_candidates

HERE = Path(__file__).resolve().parent
HOST_DELAYS = {"api.github.com": 7.0, "export.arxiv.org": 3.1,
               "api.crossref.org": 1.0, "zenodo.org": 1.0}
MAX_BYTES = 10 * 1024 * 1024


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, value: object) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def source_query(query_id: str, group: str, provider: str, text: str) -> SourceQuery:
    return SourceQuery(query_id, "dataset_tool", group, "tool", "high_precision",
                       "tool_discovery", provider,
                       "boolean" if provider == "arxiv" else "provider_specific",
                       ("paper", "tool", "dataset"), "non_operational", text)


def build_plan(config: dict, phase: str, limit: int) -> list[dict]:
    """布尔式只用于 arXiv；Crossref 排序检索与种子核验明确分开。"""
    stage = config[phase]
    rows = []
    for group in stage["groups"]:
        for term_type, terms in (("anchor", group["terms"]),
                                 ("required_context", group["required"])):
            for term in terms:
                rows.append(KeywordRow(group["id"], "dataset_tool", "tool", term,
                                       term_type, "both", "paper;tool;dataset",
                                       "non_operational", True, phase))
    plan = []

    def add(provider, group, text, url, mode="search"):
        qid = f"{phase}_{len(plan) + 1:03}_{provider}"
        plan.append({"query": asdict(source_query(qid, group, provider, text)),
                     "url": url, "mode": mode, "limit": limit})

    for generated in build_queries(rows, ("arxiv",)):
        if generated.query_variant == "high_precision":
            add("arxiv", generated.concept_group, generated.query_string,
                "https://export.arxiv.org/api/query?" + urlencode({
                    "search_query": generated.query_string, "start": 0,
                    "max_results": limit, "sortBy": "relevance"}))
    for group in stage["groups"]:
        add("crossref", group["id"], group["crossref"],
            "https://api.crossref.org/works?" + urlencode({
                "query.bibliographic": group["crossref"], "rows": limit}))
    for query in stage["github_queries"]:
        add("github", "repository_discovery", query,
            "https://api.github.com/search/repositories?" + urlencode({"q": query, "per_page": limit}))
    for repo in stage["github_seeds"]:
        add("github", "known_repository", repo, f"https://api.github.com/repos/{repo}", "seed")
    for seed in stage["paper_seeds"]:
        if "doi" in seed:
            add("crossref", "known_paper", seed["reason"],
                f"https://api.crossref.org/works/{seed['doi']}", "seed")
        else:
            add("arxiv", "known_paper", seed["reason"],
                "https://export.arxiv.org/api/query?" + urlencode({"id_list": seed["arxiv"]}), "seed")
    for query in stage["zenodo_queries"]:
        add("zenodo", "dataset_discovery", query,
            "https://zenodo.org/api/records?" + urlencode({"q": query, "size": limit, "type": "dataset"}))
    for record in stage["zenodo_seeds"]:
        add("zenodo", "known_dataset", str(record), f"https://zenodo.org/api/records/{record}", "seed")
    return plan


def make_candidate(query: SourceQuery, *, identifier: str, kind: str, title: str,
                   url: str, description: str = "", doi: str = "", authors=(),
                   year=None, raw=None) -> RawCandidate:
    return RawCandidate(source=query.platform, source_id=f"{query.platform}:{identifier}",
                        source_type=kind, title=title.strip(), source_url=url,
                        topic_track=query.topic_track, query_id=query.query_id,
                        query_variant=query.query_variant, query_purpose=query.query_purpose,
                        platform=query.platform, expected_entities=query.expected_entities,
                        safety_level=query.safety_level, abstract=description, doi=doi,
                        authors=tuple(authors), year=year, raw=raw or {})


def parse_response(item: dict, body: bytes) -> tuple[list[RawCandidate], int, bool]:
    query = SourceQuery(**{**item["query"], "expected_entities": tuple(item["query"]["expected_entities"])})
    if query.platform in {"arxiv", "crossref"}:
        adapter = ArxivAdapter() if query.platform == "arxiv" else CrossrefAdapter()
        parsed = adapter.parse_response(body.decode("utf-8"), query)
        return list(parsed.candidates), parsed.hit_count, False
    payload = json.loads(body)
    candidates = []
    if query.platform == "github":
        entries = payload["items"] if item["mode"] == "search" else [payload]
        total = payload["total_count"] if item["mode"] == "search" else 1
        incomplete = bool(payload.get("incomplete_results", False))
        for entry in entries:
            raw = {key: entry.get(key) for key in (
                "license", "language", "archived", "pushed_at", "default_branch", "stargazers_count", "topics")}
            raw["license_status"] = "metadata_only" if raw["license"] else "not_reported"
            candidates.append(make_candidate(query, identifier=str(entry["id"]), kind="repo",
                title=entry["full_name"], url=entry["html_url"],
                description=entry.get("description") or "", raw=raw))
    elif query.platform == "zenodo":
        entries = payload["hits"]["hits"] if item["mode"] == "search" else [payload]
        total = payload["hits"]["total"] if item["mode"] == "search" else 1
        if isinstance(total, dict):
            total = total["value"]
        incomplete = False
        for entry in entries:
            metadata = entry["metadata"]
            raw = {key: metadata.get(key) for key in (
                "license", "access_right", "resource_type", "related_identifiers", "version")}
            raw["files"] = [{k: f.get(k) for k in ("key", "size", "checksum", "links")}
                            for f in entry.get("files", [])]
            raw["files_downloaded"] = False
            raw["conceptdoi"] = entry.get("conceptdoi")
            raw["license_status"] = "metadata_only" if raw["license"] else "not_reported"
            # 不能把数据论文或 software 记录默认为实验数据。
            resource_type = (metadata.get("resource_type") or {}).get("type")
            kind = "dataset_card" if resource_type == "dataset" else "website"
            date = metadata.get("publication_date", "")
            candidates.append(make_candidate(query, identifier=str(entry["id"]), kind=kind,
                title=metadata["title"], url=f"https://zenodo.org/records/{entry['id']}",
                description=strip_markup(metadata.get("description", "")), doi=metadata.get("doi", ""),
                authors=[c["name"] for c in metadata.get("creators", [])],
                year=int(date[:4]) if re.match(r"^\d{4}", date) else None, raw=raw))
    else:
        raise ValueError(f"Unsupported provider: {query.platform}")
    if not isinstance(total, int) or total < len(candidates):
        raise ValueError("Invalid source hit count")
    return candidates, total, incomplete


class SourceRedirects(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urlparse(newurl)
        if parsed.scheme != "https" or parsed.hostname not in HOST_DELAYS:
            raise ValueError("Unexpected API redirect host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


class Fetcher:
    def __init__(self, *, allow_network: bool):
        self.allow_network = allow_network
        self.last_request = {}
        self.opener = build_opener(SourceRedirects())

    def fetch(self, url: str) -> bytes:
        if not self.allow_network:
            raise ValueError("Network disabled; use --allow-network or replay")
        parsed = urlparse(url)
        if parsed.scheme != "https" or parsed.hostname not in HOST_DELAYS:
            raise ValueError("URL outside configured public APIs")
        host = parsed.hostname
        remaining = HOST_DELAYS[host] - (time.monotonic() - self.last_request.get(host, 0))
        if remaining > 0:
            time.sleep(remaining)
        self.last_request[host] = time.monotonic()
        request = Request(url, headers={"User-Agent": "SciExchange-research/0.1",
                                       "Accept": "application/json, application/atom+xml"})
        with self.opener.open(request, timeout=20) as response:
            body = response.read(MAX_BYTES + 1)
        if len(body) > MAX_BYTES:
            raise ValueError("Metadata response exceeds 10 MiB")
        return body


def priority(candidate: RawCandidate, phase: str) -> tuple[int, list[str]]:
    """透明的阅读优先级，不是质量、科学正确性或适用性判定。"""
    text = f"{candidate.title} {candidate.abstract}".casefold()
    if phase == "frameworks":
        terms = ["scicat", "data marketplace", "data catalog", "metadata catalog", "provenance",
                 "cloud lab", "battery data", "galvanalyser", "data discovery", "oceanprotocol"]
    elif phase == "battery_data":
        terms = ["battery", "lithium", "ageing", "aging", "degradation", "cycling", "temperature"]
    else:
        terms = ["dark data", "failed experiment", "negative result", "lean 4", "formal verification",
                 "tafel", "faradaic", "invariants", "barter", "zero-trust", "cwc", "safety",
                 "prompt injection", "provenance", "benford", "battery", "catalysis", "shapley", "matching"]
    matches = [term for term in terms if term in text]
    return len(matches), matches


def build_outputs(candidates: list[RawCandidate], phase: str, out: Path) -> dict:
    result = deduplicate_candidates(candidates)
    records = []
    for group in result.groups:
        candidate = group.representative.candidate
        score, matches = priority(candidate, phase)
        records.append({"id": group.canonical_id, "title": candidate.title,
            "kind": group.representative.artifact_type, "url": candidate.source_url,
            "doi": candidate.doi, "year": candidate.year, "abstract": candidate.abstract,
            "priority_score": score, "matched_terms": matches,
            "review_status": "unreviewed", "verification_level": "metadata_only",
            "identity_review_required": group.needs_review,
            "identity_review_reasons": group.review_reasons,
            "query_ids": group.query_ids, "source_ids": group.source_ids,
            "observations": [asdict(member.candidate) for member in group.members]})
    records.sort(key=lambda row: (-row["priority_score"], row["id"]))
    with (out / "candidates.jsonl").open("w", encoding="utf-8") as stream:
        for record in records:
            stream.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    write_json(out / "identity_reviews.json", [asdict(review) for review in result.reviews])
    phase_titles = {
        "frameworks": "框架",
        "battery_data": "电池数据",
        "catalysis_and_physics": "电催化与形式化验证",
        "deep_scientific_mining": "深度多维科学挖掘",
        "multidisciplinary_frontier_mining": "多学科前沿交叉挖掘"
    }
    title_prefix = phase_titles.get(phase, phase)
    lines = [f"# {title_prefix}候选检索结果", "",
             f"返回 {len(candidates)} 条出现记录，归并为 {len(records)} 个候选。", "",
             "状态均为元数据候选；只按词面线索安排阅读顺序。种子单列于 queries.json；不是独立检索发现。",
             "API 总命中数、截断和失败见 requests.json。记录完整不代表检索穷尽、全文阅读、许可核准或数据入库。", ""]
    for kind in sorted({row["kind"] for row in records}):
        subset = [row for row in records if row["kind"] == kind]
        lines += [f"## {kind}（{len(subset)}）", ""]
        for row in subset:
            title = row["title"].replace("\n", " ").replace("[", "(").replace("]", ")")
            lines += [f"- [{title}]({row['url']}) · 阅读优先级 {row['priority_score']} · {row['review_status']}"]
        lines.append("")
    (out / "report.md").write_text("\n".join(lines), encoding="utf-8")
    return {"occurrences": len(candidates), "candidates": len(records),
            "identity_review_pairs": len(result.reviews)}


def run(config_path: Path, phase: str, limit: int, out: Path, *, allow_network=False,
        replay: Path | None = None) -> dict:
    if not 1 <= limit <= 30:
        raise ValueError("limit must be in 1..30")
    config_bytes = config_path.read_bytes()
    config = json.loads(config_bytes)
    plan = build_plan(config, phase, limit)
    previous = None
    if replay:
        manifest = json.loads((replay / "run_manifest.json").read_text())
        if manifest["config_sha256"] != digest(config_bytes) or manifest["phase"] != phase or manifest["limit"] != limit:
            raise ValueError("Replay config/phase/limit differs from source run")
        previous = {row["query_id"]: row for row in json.loads((replay / "requests.json").read_text())}
    elif not allow_network:
        raise ValueError("run requires --allow-network; offline replay uses --replay")
    out.mkdir(parents=True, exist_ok=False)
    (out / "raw").mkdir()
    (out / "keywords.json").write_bytes(config_bytes)
    write_json(out / "queries.json", plan)
    fetcher = Fetcher(allow_network=allow_network)
    candidates, logs = [], []
    for index, item in enumerate(plan, 1):
        qid = item["query"]["query_id"]
        log = {"query_id": qid, "url": item["url"], "mode": item["mode"],
               "status": "error", "retrieved_at": datetime.now(timezone.utc).isoformat()}
        try:
            if previous is not None:
                old = previous[qid]
                if old["url"] != item["url"]:
                    raise ValueError("Replay URL mismatch")
                if old["status"] != "ok":
                    raise ValueError("Original request failed: " + old.get("error", "unknown"))
                body = (replay / "raw" / f"{qid}.response").read_bytes()
                if digest(body) != old["response_sha256"]:
                    raise ValueError("Replay response SHA-256 mismatch")
                log["original_retrieved_at"] = old["retrieved_at"]
            else:
                body = fetcher.fetch(item["url"])
            (out / "raw" / f"{qid}.response").write_bytes(body)
            log["response_sha256"] = digest(body)
            parsed, hit_count, incomplete = parse_response(item, body)
            candidates.extend(parsed)
            log.update(status="ok", hit_count=hit_count, returned=len(parsed),
                       truncated=hit_count > len(parsed), source_incomplete=incomplete)
        except (HTTPError, URLError, TimeoutError, OSError, ValueError, KeyError, TypeError) as error:
            log["error"] = f"{type(error).__name__}: {error}"
        logs.append(log)
        write_json(out / "requests.json", logs)
        print(f"{index}/{len(plan)} {qid}: {log['status']} ({log.get('returned', 0)})", flush=True)
    counts = build_outputs(candidates, phase, out)
    errors = sum(log["status"] != "ok" for log in logs)
    incomplete = sum(bool(log.get("source_incomplete")) for log in logs)
    code_files = sorted(HERE.glob("*.py")) + sorted((HERE / "vendor").rglob("*.py"))
    manifest = {"phase": phase, "limit": limit, "config_sha256": digest(config_bytes),
                "status": "partial" if errors or incomplete else "complete", "counts": counts,
                "requests": len(logs), "request_errors": errors, "source_incomplete": incomplete,
                "scope": "bounded_metadata_discovery", "python": platform.python_version(),
                "replay_of": str(replay) if replay else None,
                "sfm_upstream": json.loads((HERE / "vendor/UPSTREAM.json").read_text()),
                "code_sha256": {str(p.relative_to(HERE)): digest(p.read_bytes()) for p in code_files},
                "output_sha256": {p.name: digest(p.read_bytes()) for p in out.iterdir() if p.is_file()}}
    write_json(out / "run_manifest.json", manifest)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("plan", "run"))
    parser.add_argument("--phase", required=True)
    parser.add_argument("--config", type=Path, default=HERE / "keywords.json")
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--out", type=Path, required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--allow-network", action="store_true")
    mode.add_argument("--replay", type=Path)
    args = parser.parse_args()
    if not 1 <= args.limit <= 30:
        parser.error("--limit must be 1..30")
    if args.command == "plan":
        args.out.mkdir(parents=True, exist_ok=False)
        write_json(args.out / "queries.json", build_plan(json.loads(args.config.read_text()), args.phase, args.limit))
        return 0
    manifest = run(args.config, args.phase, args.limit, args.out,
                   allow_network=args.allow_network, replay=args.replay)
    print(json.dumps({k: manifest[k] for k in ("status", "counts", "requests", "request_errors")}, ensure_ascii=False))
    return 0 if manifest["status"] == "complete" else 2


if __name__ == "__main__":
    sys.exit(main())
