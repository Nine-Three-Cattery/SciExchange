"""Local fixture loader for offline demos/imports. This is not an access-control service."""
import csv
import hashlib
import json
from pathlib import Path


def _checked_path(root, relative, expected):
    path = (root/relative).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError("Fixture path escapes slice directory")
    if hashlib.sha256(path.read_bytes()).hexdigest() != expected:
        raise ValueError(f"Fixture integrity check failed: {relative}")
    return path


def load_slices(directory: Path) -> dict:
    manifest = json.loads((directory/"manifest.json").read_text())
    if manifest.get("schema_version") != "science-slices-1.0":
        raise ValueError("Unsupported fixture schema")
    slices = {}
    for source in manifest["sources"]:
        _checked_path(directory, source["file"], source["sha256"])
    for entry in manifest["entries"]:
        path = _checked_path(directory, entry["metadata_file"], entry["metadata_sha256"])
        record = json.loads(path.read_text())
        csv_path = _checked_path(directory, record["csv_file"], record["csv_sha256"])
        with csv_path.open(newline="") as stream:
            reader = csv.reader(stream)
            if next(reader) != record["columns"]:
                raise ValueError("CSV columns disagree with metadata")
            rows = [[float(v) for v in row] for row in reader]
        if len(rows) != record["row_count"] or record["slice_id"] != entry["slice_id"]:
            raise ValueError("Fixture identity or row count mismatch")
        if record["slice_id"] in slices:
            raise ValueError("Duplicate slice identity")
        slices[record["slice_id"]] = {k: record[k] for k in ("slice_id", "version", "domain", "columns", "metadata")}
        slices[record["slice_id"]]["rows"] = rows
    return slices
