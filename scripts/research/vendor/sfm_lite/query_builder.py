from __future__ import annotations

import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Sequence


TRACK_PREFIXES = {
    "sfm_model": "MODEL",
    "scientific_representation": "REP",
    "safety_attack": "ATTACK",
    "benchmark_metric": "BENCH",
    "judge_guardrail": "JUDGE",
    "dataset_tool": "TOOL",
    "domain_risk": "RISK",
}

QUERY_PURPOSES = {
    "model": "model_discovery",
    "representation": "representation_discovery",
    "attack": "attack_discovery",
    "benchmark": "benchmark_discovery",
    "judge": "judge_discovery",
    "tool": "tool_discovery",
    "risk": "risk_discovery",
}

TRACK_QUERY_FAMILIES = {
    "sfm_model": {"model"},
    "scientific_representation": {"representation"},
    "safety_attack": {"attack"},
    "benchmark_metric": {"benchmark"},
    "judge_guardrail": {"judge"},
    "dataset_tool": {"tool"},
    "domain_risk": {"risk"},
}

QUERY_PLATFORMS = (
    "arxiv",
    "openalex",
    "semantic_scholar",
    "wos",
    "scopus",
)
QUERY_VARIANTS = ("broad", "high_precision")
TERM_TYPES = {"anchor", "synonym", "context", "required_context", "exclude"}
QUERY_SCOPES = {"broad", "high_precision", "both"}
EXPECTED_ENTITY_ROLES = {
    "attack_method",
    "benchmark",
    "dataset",
    "guardrail",
    "judge",
    "metric",
    "model",
    "paper",
    "representation",
    "risk_context",
    "tool",
}
SAFETY_LEVELS = {"non_operational"}

PLATFORM_QUERY_SEMANTICS = {
    "arxiv": "boolean",
    "openalex": "boolean",
    "semantic_scholar": "boolean_bulk",
    "wos": "boolean",
    "scopus": "boolean",
}

KEYWORD_FIELDS = [
    "concept_group",
    "topic_track",
    "query_family",
    "term",
    "term_type",
    "query_scope",
    "expected_entities",
    "safety_level",
    "enabled",
    "notes",
]

GENERATED_QUERY_FIELDS = [
    "query_id",
    "topic_track",
    "concept_group",
    "query_family",
    "query_variant",
    "query_purpose",
    "platform",
    "query_semantics",
    "expected_entities",
    "safety_level",
    "query_string",
    "required_context_terms",
    "negative_terms",
    "source_keyword_count",
]

_IDENTIFIER_PATTERN = re.compile(r"^[a-z0-9_]+$")
_TRUE_VALUES = {"1", "true", "yes", "y"}
_FALSE_VALUES = {"0", "false", "no", "n"}


@dataclass(frozen=True)
class KeywordRow:
    concept_group: str
    topic_track: str
    query_family: str
    term: str
    term_type: str
    query_scope: str
    expected_entities: str
    safety_level: str
    enabled: bool
    notes: str


@dataclass(frozen=True)
class GeneratedQuery:
    query_id: str
    topic_track: str
    concept_group: str
    query_family: str
    query_variant: str
    query_purpose: str
    platform: str
    query_semantics: str
    expected_entities: str
    safety_level: str
    query_string: str
    required_context_terms: str
    negative_terms: str
    source_keyword_count: int

    def as_csv_row(self) -> dict[str, str | int]:
        return {
            "query_id": self.query_id,
            "topic_track": self.topic_track,
            "concept_group": self.concept_group,
            "query_family": self.query_family,
            "query_variant": self.query_variant,
            "query_purpose": self.query_purpose,
            "platform": self.platform,
            "query_semantics": self.query_semantics,
            "expected_entities": self.expected_entities,
            "safety_level": self.safety_level,
            "query_string": self.query_string,
            "required_context_terms": self.required_context_terms,
            "negative_terms": self.negative_terms,
            "source_keyword_count": self.source_keyword_count,
        }


def _parse_bool(value: str, *, row_number: int) -> bool:
    normalized = value.strip().lower()
    if normalized in _TRUE_VALUES:
        return True
    if normalized in _FALSE_VALUES:
        return False
    raise ValueError(
        f"keyword table row {row_number}: enabled must be a boolean, got {value!r}"
    )


def _entity_roles(value: str) -> frozenset[str]:
    return frozenset(role.strip() for role in value.split(";") if role.strip())


def read_keyword_table(path: Path) -> list[KeywordRow]:
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != KEYWORD_FIELDS:
            raise ValueError(
                f"keyword table columns must be {KEYWORD_FIELDS!r}, "
                f"got {reader.fieldnames!r}"
            )

        rows = []
        for row_number, raw in enumerate(reader, start=2):
            if None in raw:
                raise ValueError(
                    f"keyword table row {row_number}: unexpected extra columns"
                )
            missing = [
                field
                for field in KEYWORD_FIELDS
                if field != "notes" and not (raw.get(field) or "").strip()
            ]
            if missing:
                raise ValueError(
                    f"keyword table row {row_number}: empty fields {missing!r}"
                )
            rows.append(
                KeywordRow(
                    concept_group=raw["concept_group"].strip(),
                    topic_track=raw["topic_track"].strip(),
                    query_family=raw["query_family"].strip(),
                    term=raw["term"].strip(),
                    term_type=raw["term_type"].strip(),
                    query_scope=raw["query_scope"].strip(),
                    expected_entities=raw["expected_entities"].strip(),
                    safety_level=raw["safety_level"].strip(),
                    enabled=_parse_bool(raw["enabled"], row_number=row_number),
                    notes=raw["notes"].strip(),
                )
            )
    validate_keyword_rows(rows)
    return rows


def validate_keyword_rows(rows: Sequence[KeywordRow]) -> None:
    if not rows:
        raise ValueError("keyword table must contain at least one row")

    duplicate_keys: set[tuple[str, str]] = set()
    grouped_rows: dict[str, list[KeywordRow]] = {}
    for row in rows:
        if not row.term:
            raise ValueError("keyword term must not be empty")
        if not row.expected_entities:
            raise ValueError(
                f"expected_entities must not be empty for {row.concept_group!r}"
            )
        entity_roles = _entity_roles(row.expected_entities)
        if not entity_roles:
            raise ValueError(
                f"expected_entities must contain at least one role for "
                f"{row.concept_group!r}"
            )
        unsupported_entity_roles = sorted(entity_roles - EXPECTED_ENTITY_ROLES)
        if unsupported_entity_roles:
            raise ValueError(
                f"unsupported expected entity roles for {row.concept_group!r}: "
                f"{unsupported_entity_roles!r}"
            )
        if row.safety_level not in SAFETY_LEVELS:
            raise ValueError(f"unsupported safety_level: {row.safety_level!r}")
        if not _IDENTIFIER_PATTERN.fullmatch(row.concept_group):
            raise ValueError(f"invalid concept_group: {row.concept_group!r}")
        if row.topic_track not in TRACK_PREFIXES:
            raise ValueError(f"unsupported topic_track: {row.topic_track!r}")
        if row.query_family not in QUERY_PURPOSES:
            raise ValueError(f"unsupported query_family: {row.query_family!r}")
        if row.query_family not in TRACK_QUERY_FAMILIES[row.topic_track]:
            raise ValueError(
                f"query_family {row.query_family!r} is not allowed for "
                f"topic_track {row.topic_track!r}"
            )
        if row.term_type not in TERM_TYPES:
            raise ValueError(f"unsupported term_type: {row.term_type!r}")
        if row.query_scope not in QUERY_SCOPES:
            raise ValueError(f"unsupported query_scope: {row.query_scope!r}")

        duplicate_key = (row.concept_group, row.term.casefold())
        if duplicate_key in duplicate_keys:
            raise ValueError(
                f"duplicate term in concept_group {row.concept_group!r}: {row.term!r}"
            )
        duplicate_keys.add(duplicate_key)
        grouped_rows.setdefault(row.concept_group, []).append(row)

    for concept_group, group_rows in grouped_rows.items():
        for field in ("topic_track", "query_family", "safety_level"):
            values = {getattr(row, field) for row in group_rows}
            if len(values) != 1:
                raise ValueError(
                    f"concept_group {concept_group!r} has inconsistent {field}: "
                    f"{sorted(values)!r}"
                )

        enabled_positive_rows = [
            row for row in group_rows if row.enabled and row.term_type != "exclude"
        ]
        if not enabled_positive_rows:
            raise ValueError(
                f"concept_group {concept_group!r} has no enabled positive terms"
            )
        if not any(row.term_type == "anchor" for row in enabled_positive_rows):
            raise ValueError(
                f"concept_group {concept_group!r} has no enabled anchor term"
            )
        for variant in QUERY_VARIANTS:
            if not _variant_terms(enabled_positive_rows, variant):
                raise ValueError(
                    f"concept_group {concept_group!r} has no positive terms "
                    f"for query variant {variant!r}"
                )


def _group_enabled_keywords(rows: Iterable[KeywordRow]) -> dict[str, list[KeywordRow]]:
    groups: dict[str, list[KeywordRow]] = {}
    for row in rows:
        if not row.enabled or row.term_type == "exclude":
            continue
        groups.setdefault(row.concept_group, []).append(row)
    return groups


def _allowed_scopes(variant: str) -> set[str]:
    if variant == "broad":
        return {"broad", "both"}
    if variant == "high_precision":
        return {"high_precision", "both"}
    raise ValueError(f"unsupported query variant: {variant!r}")


def _negative_terms(
    rows: Iterable[KeywordRow],
    concept_group: str,
    variant: str,
) -> list[str]:
    allowed_scopes = _allowed_scopes(variant)
    terms = [
        row.term
        for row in rows
        if row.enabled
        and row.term_type == "exclude"
        and row.concept_group == concept_group
        and row.query_scope in allowed_scopes
    ]
    return sorted(dict.fromkeys(terms))


def _variant_terms(rows: Sequence[KeywordRow], variant: str) -> list[str]:
    allowed_scopes = _allowed_scopes(variant)
    terms = [
        row.term
        for row in rows
        if row.query_scope in allowed_scopes
        and row.term_type in {"anchor", "synonym", "context"}
        and not (variant == "high_precision" and row.term_type == "context")
    ]
    return sorted(dict.fromkeys(terms))


def _required_context_terms(
    rows: Sequence[KeywordRow],
    variant: str,
) -> list[str]:
    allowed_scopes = _allowed_scopes(variant)
    terms = [
        row.term
        for row in rows
        if row.term_type == "required_context" and row.query_scope in allowed_scopes
    ]
    return sorted(dict.fromkeys(terms))


def _quote(term: str, platform: str) -> str:
    escaped = term.replace('"', '\\"')
    if platform == "arxiv":
        return f'all:"{escaped}"'
    if platform == "scopus":
        return f'TITLE-ABS-KEY("{escaped}")'
    if platform == "wos":
        return f'TS=("{escaped}")'
    return f'"{escaped}"'


def _join_terms(terms: Sequence[str], platform: str, *, operator: str) -> str:
    quoted = [_quote(term, platform) for term in terms]
    if len(quoted) == 1:
        return quoted[0]
    return "(" + f" {operator} ".join(quoted) + ")"


def _boolean_exclude_clause(
    negative_terms: Sequence[str],
    platform: str,
) -> str:
    if not negative_terms:
        return ""
    if platform == "arxiv":
        return " ".join(f"ANDNOT {_quote(term, platform)}" for term in negative_terms)
    if platform in {"scopus", "wos"}:
        return " ".join(f"AND NOT {_quote(term, platform)}" for term in negative_terms)
    return f"NOT {_join_terms(negative_terms, platform, operator='OR')}"


def _semantic_scholar_query(
    terms: Sequence[str],
    required_context_terms: Sequence[str],
    negative_terms: Sequence[str],
) -> str:
    positive = _join_terms(terms, "semantic_scholar", operator="|")
    required = (
        f"+ {_join_terms(required_context_terms, 'semantic_scholar', operator='|')}"
        if required_context_terms
        else ""
    )
    negative = " ".join(
        f"-{_quote(term, 'semantic_scholar')}" for term in negative_terms
    )
    return " ".join(clause for clause in (positive, required, negative) if clause)


def build_query_string(
    terms: Sequence[str],
    negative_terms: Sequence[str],
    platform: str,
    *,
    required_context_terms: Sequence[str] = (),
) -> str:
    platform_name = platform.strip().lower()
    if platform_name not in QUERY_PLATFORMS:
        raise ValueError(f"unsupported query platform: {platform!r}")
    if not terms:
        raise ValueError("at least one positive query term is required")

    if platform_name == "semantic_scholar":
        return _semantic_scholar_query(
            terms,
            required_context_terms,
            negative_terms,
        )

    positive = _join_terms(terms, platform_name, operator="OR")
    required_context = (
        f"AND {_join_terms(required_context_terms, platform_name, operator='OR')}"
        if required_context_terms
        else ""
    )
    negative = _boolean_exclude_clause(negative_terms, platform_name)
    return " ".join(
        clause for clause in (positive, required_context, negative) if clause
    )


def _query_purpose(query_family: str, variant: str) -> str:
    if variant == "broad":
        return "broad_discovery"
    return QUERY_PURPOSES[query_family]


def _expected_entities(group_rows: Sequence[KeywordRow]) -> str:
    entities = {
        entity.strip()
        for row in group_rows
        for entity in row.expected_entities.split(";")
        if entity.strip()
    }
    return ";".join(sorted(entities))


def build_queries(
    rows: Sequence[KeywordRow],
    platforms: Sequence[str] = QUERY_PLATFORMS,
) -> list[GeneratedQuery]:
    validate_keyword_rows(rows)
    normalized_platforms = tuple(platform.strip().lower() for platform in platforms)
    if not normalized_platforms:
        raise ValueError("at least one query platform is required")
    unsupported = sorted(set(normalized_platforms) - set(QUERY_PLATFORMS))
    if unsupported:
        raise ValueError(f"unsupported query platforms: {unsupported!r}")
    if len(normalized_platforms) != len(set(normalized_platforms)):
        raise ValueError("query platforms must not contain duplicates")

    groups = _group_enabled_keywords(rows)
    queries: list[GeneratedQuery] = []
    for concept_group in sorted(groups):
        group_rows = groups[concept_group]
        first = group_rows[0]
        prefix = TRACK_PREFIXES[first.topic_track]

        for variant in QUERY_VARIANTS:
            terms = _variant_terms(group_rows, variant)
            required_context_terms = _required_context_terms(group_rows, variant)
            negative_terms = _negative_terms(rows, concept_group, variant)

            for platform in normalized_platforms:
                query_id = (
                    f"{prefix}_{concept_group.upper()}_"
                    f"{variant.upper()}_{platform.upper()}"
                )
                queries.append(
                    GeneratedQuery(
                        query_id=query_id,
                        topic_track=first.topic_track,
                        concept_group=concept_group,
                        query_family=first.query_family,
                        query_variant=variant,
                        query_purpose=_query_purpose(first.query_family, variant),
                        platform=platform,
                        query_semantics=PLATFORM_QUERY_SEMANTICS[platform],
                        expected_entities=_expected_entities(group_rows),
                        safety_level=first.safety_level,
                        query_string=build_query_string(
                            terms,
                            negative_terms,
                            platform,
                            required_context_terms=required_context_terms,
                        ),
                        required_context_terms=";".join(required_context_terms),
                        negative_terms=";".join(negative_terms),
                        source_keyword_count=len(terms),
                    )
                )
    return queries


def write_generated_queries(queries: Sequence[GeneratedQuery], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=GENERATED_QUERY_FIELDS,
            lineterminator="\n",
        )
        writer.writeheader()
        for query in queries:
            writer.writerow(query.as_csv_row())


def generate_query_file(
    keyword_table: Path,
    output: Path,
    *,
    platforms: Sequence[str] = QUERY_PLATFORMS,
) -> int:
    queries = build_queries(read_keyword_table(keyword_table), platforms)
    write_generated_queries(queries, output)
    return len(queries)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="sfmsafelens-build-queries",
        description=(
            "Generate platform-specific literature queries from a keyword table."
        ),
    )
    parser.add_argument("--keywords", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--platform",
        action="append",
        choices=QUERY_PLATFORMS,
        default=[],
        help="Generate only this platform; repeat to select multiple platforms.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    generate_query_file(
        args.keywords,
        args.output,
        platforms=args.platform or QUERY_PLATFORMS,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
