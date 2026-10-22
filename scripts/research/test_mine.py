"""验证来源身份、检索边界和离线重放，不把命中当作科学结论。"""
import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

import mine
from vendor.sfm_lite.candidates.deduplication import deduplicate_candidates


def github_item(query_id="github_1"):
    query = mine.source_query(query_id, "test_group", "github", "battery data")
    return {"query": mine.asdict(query), "mode": "search", "limit": 1,
            "url": "https://api.github.com/search/repositories?q=battery"}


def github_body():
    return json.dumps({"total_count": 99, "incomplete_results": False, "items": [{
        "id": 123, "full_name": "example/battery", "html_url": "https://github.com/example/battery",
        "description": "Battery data", "license": None}]}).encode()


class MiningTests(unittest.TestCase):
    def test_original_sfm_implementation_hashes(self):
        upstream = json.loads((mine.HERE / "vendor/UPSTREAM.json").read_text())
        for entry in upstream["files"]:
            self.assertEqual(mine.digest((mine.HERE / "vendor/sfm_lite" / entry["vendored_path"]).read_bytes()), entry["sha256"])

    def test_queries_use_new_topics_and_provider_semantics(self):
        config = json.loads((mine.HERE / "keywords.json").read_text())
        for phase in ("frameworks", "battery_data"):
            plan = mine.build_plan(config, phase, 5)
            self.assertEqual(len({p["query"]["query_id"] for p in plan}), len(plan))
            arxiv = [p for p in plan if p["query"]["platform"] == "arxiv" and p["mode"] == "search"]
            self.assertEqual(len(arxiv), len(config[phase]["groups"]))
            self.assertTrue(all("all:" in p["query"]["query_string"] for p in arxiv))
            crossref = [p for p in plan if p["query"]["platform"] == "crossref" and p["mode"] == "search"]
            self.assertTrue(all(p["query"]["query_semantics"] == "provider_specific" for p in crossref))

    def test_duplicate_doi_keeps_both_query_provenances(self):
        query = mine.source_query("first", "test", "crossref", "test")
        first = mine.make_candidate(query, identifier="1", kind="paper", title="Battery data",
            url="https://doi.org/10.1234/example", doi="10.1234/example")
        second = replace(first, source="arxiv", source_id="arxiv:2", query_id="second", platform="arxiv")
        result = deduplicate_candidates([first, second])
        self.assertEqual(len(result.groups), 1)
        self.assertEqual(result.groups[0].query_ids, ("first", "second"))

    def test_conflicting_dois_are_not_silently_merged(self):
        query = mine.source_query("first", "test", "arxiv", "test")
        first = mine.make_candidate(query, identifier="1", kind="preprint", title="Same title",
            url="https://arxiv.org/abs/2401.00001", doi="10.1234/first")
        first = replace(first, arxiv_id="2401.00001")
        second = replace(first, source_id="arxiv:2", query_id="second", doi="10.1234/second")
        result = deduplicate_candidates([first, second])
        self.assertEqual(len(result.groups), 2)
        self.assertTrue(result.reviews)

    def test_missing_license_stays_unknown_and_total_is_not_returned_count(self):
        candidates, total, incomplete = mine.parse_response(github_item(), github_body())
        self.assertEqual(total, 99)
        self.assertEqual(len(candidates), 1)
        self.assertFalse(incomplete)
        self.assertIsNone(candidates[0].raw["license"])
        self.assertEqual(candidates[0].raw["license_status"], "not_reported")

    def test_zenodo_software_is_not_experimental_dataset(self):
        item = {"query": mine.asdict(mine.source_query("zenodo_1", "test", "zenodo", "battery")), "mode": "seed"}
        payload = {"id": 123, "metadata": {"title": "Battery code", "resource_type": {"type": "software"}}, "files": []}
        records, _, _ = mine.parse_response(item, json.dumps(payload).encode())
        self.assertEqual(records[0].source_type, "website")
        self.assertFalse(records[0].raw["files_downloaded"])

    def test_network_requires_explicit_flag(self):
        with self.assertRaisesRegex(ValueError, "Network disabled"):
            mine.Fetcher(allow_network=False).fetch("https://api.github.com/repos/example/test")

    def test_live_fixture_replay_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            plan = [github_item()]
            config = mine.HERE / "keywords.json"
            with patch.object(mine, "build_plan", return_value=plan):
                with patch.object(mine.Fetcher, "fetch", return_value=github_body()):
                    live = mine.run(config, "frameworks", 1, root / "first", allow_network=True)
                self.assertEqual(live["status"], "complete")
                with patch.object(mine.Fetcher, "fetch", side_effect=AssertionError("Replay must be offline")):
                    replay = mine.run(config, "frameworks", 1, root / "second", replay=root / "first")
                self.assertEqual(replay["counts"], live["counts"])
                self.assertEqual((root / "first/candidates.jsonl").read_bytes(), (root / "second/candidates.jsonl").read_bytes())
                (root / "first/raw/github_1.response").write_bytes(b"altered")
                damaged = mine.run(config, "frameworks", 1, root / "damaged", replay=root / "first")
                self.assertEqual(damaged["status"], "partial")
                self.assertEqual(damaged["counts"]["candidates"], 0)
                self.assertIn("SHA-256 mismatch", (root / "damaged/requests.json").read_text())

    def test_request_failure_is_not_zero_hit_success(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.object(mine, "build_plan", return_value=[github_item()]):
                with patch.object(mine.Fetcher, "fetch", side_effect=TimeoutError("fixture timeout")):
                    result = mine.run(mine.HERE / "keywords.json", "frameworks", 1, Path(folder) / "run", allow_network=True)
            self.assertEqual(result["status"], "partial")
            self.assertEqual(result["request_errors"], 1)


if __name__ == "__main__":
    unittest.main()
