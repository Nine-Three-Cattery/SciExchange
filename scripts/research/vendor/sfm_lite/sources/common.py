from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlparse

from ..query_builder import (
    EXPECTED_ENTITY_ROLES,
    PLATFORM_QUERY_SEMANTICS,
    QUERY_PURPOSES,
    QUERY_VARIANTS,
    SAFETY_LEVELS,
    TRACK_PREFIXES,
    TRACK_QUERY_FAMILIES,
)


GENERATED_QUERY_FIELDS = (
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
)
ALLOWED_QUERY_PURPOSES = {"broad_discovery", *QUERY_PURPOSES.values()}
# Bounded because a source name becomes a directory segment under
# results/raw/<track>/<source>/, and an unbounded one would only fail at write
# time with ENAMETOOLONG. Adapters are an injectable Protocol, so the limit has
# to be enforced here rather than assumed from the built-in adapter names.
SOURCE_NAME_PATTERN = re.compile(r"^[a-z0-9_]{1,64}$")
SOURCE_TYPES = frozenset(
    {
        "paper",
        "preprint",
        "model_card",
        "dataset_card",
        "benchmark_page",
        "repo",
        "tool",
        "policy_doc",
        "website",
        "unknown",
    }
)


class SourceParseError(ValueError):
    """Raised when a source payload cannot be parsed without guessing."""


def _require_stripped_text(record: object, fields: tuple[str, ...], label: str) -> None:
    for name in fields:
        value = getattr(record, name)
        if not value or value != value.strip():
            raise ValueError(f"{label}.{name} must be non-empty and stripped")


def _validate_entity_roles(values: tuple[str, ...], *, label: str) -> None:
    if not values:
        raise ValueError(f"{label} must not be empty")
    if len(values) != len(set(values)):
        raise ValueError(f"{label} must not contain duplicates")
    unsupported = set(values) - EXPECTED_ENTITY_ROLES
    if unsupported:
        raise ValueError(f"unsupported {label}: {sorted(unsupported)!r}")


def _validate_hit_count(hit_count: int, *, exported_count: int) -> None:
    if isinstance(hit_count, bool) or not isinstance(hit_count, int):
        raise ValueError("hit_count must be an integer")
    if hit_count < 0:
        raise ValueError("hit_count must be non-negative")
    if hit_count < exported_count:
        raise ValueError("hit_count must not be smaller than exported candidates")


def _validate_optional_int(value: int | None, *, label: str) -> None:
    if value is not None and (isinstance(value, bool) or not isinstance(value, int)):
        raise ValueError(f"{label} must be an integer or None")


def _validate_candidate_provenance(
    candidate: RawCandidate, *, source: str, query: SourceQuery
) -> None:
    if candidate.source != source:
        raise ValueError("candidate source does not match parse result")
    if candidate.query_id != query.query_id:
        raise ValueError("candidate query_id does not match parse result")
    if candidate.topic_track != query.topic_track:
        raise ValueError("candidate topic_track does not match parse result")
    if candidate.platform != query.platform:
        raise ValueError("candidate platform does not match parse result")
    if candidate.expected_entities != query.expected_entities:
        raise ValueError("candidate expected_entities do not match parse result")
    if candidate.safety_level != query.safety_level:
        raise ValueError("candidate safety_level does not match parse result")


@dataclass(frozen=True)
class SourceQuery:
    """Query provenance copied from one generated-query row."""

    query_id: str
    topic_track: str
    concept_group: str
    query_family: str
    query_variant: str
    query_purpose: str
    platform: str
    query_semantics: str
    expected_entities: tuple[str, ...]
    safety_level: str
    query_string: str

    def __post_init__(self) -> None:
        _require_stripped_text(
            self,
            (
                "query_id",
                "topic_track",
                "concept_group",
                "query_family",
                "query_variant",
                "query_purpose",
                "platform",
                "query_semantics",
                "safety_level",
                "query_string",
            ),
            "SourceQuery",
        )
        if self.topic_track not in TRACK_PREFIXES:
            raise ValueError(f"unsupported topic_track: {self.topic_track!r}")
        if self.query_family not in TRACK_QUERY_FAMILIES[self.topic_track]:
            raise ValueError(
                f"query_family {self.query_family!r} is not allowed for "
                f"topic_track {self.topic_track!r}"
            )
        if self.query_variant not in QUERY_VARIANTS:
            raise ValueError(f"unsupported query_variant: {self.query_variant!r}")
        expected_semantics = PLATFORM_QUERY_SEMANTICS.get(self.platform)
        if expected_semantics and self.query_semantics != expected_semantics:
            raise ValueError(
                f"query_semantics {self.query_semantics!r} does not match "
                f"platform {self.platform!r}"
            )
        if self.query_purpose not in ALLOWED_QUERY_PURPOSES:
            raise ValueError(f"unsupported query_purpose: {self.query_purpose!r}")
        expected_purpose = (
            "broad_discovery"
            if self.query_variant == "broad"
            else QUERY_PURPOSES[self.query_family]
        )
        if self.query_purpose != expected_purpose:
            raise ValueError(
                f"query_purpose {self.query_purpose!r} does not match "
                f"query_family {self.query_family!r} and variant "
                f"{self.query_variant!r}"
            )
        if self.safety_level not in SAFETY_LEVELS:
            raise ValueError(f"unsupported safety_level: {self.safety_level!r}")
        _validate_entity_roles(self.expected_entities, label="expected_entities")

    @classmethod
    def from_generated_query_row(cls, row: Mapping[str, str]) -> SourceQuery:
        missing = [
            name for name in GENERATED_QUERY_FIELDS if not (row.get(name) or "").strip()
        ]
        if missing:
            raise ValueError(f"generated query row has empty fields: {missing!r}")
        return cls(
            query_id=row["query_id"].strip(),
            topic_track=row["topic_track"].strip(),
            concept_group=row["concept_group"].strip(),
            query_family=row["query_family"].strip(),
            query_variant=row["query_variant"].strip(),
            query_purpose=row["query_purpose"].strip(),
            platform=row["platform"].strip(),
            query_semantics=row["query_semantics"].strip(),
            expected_entities=split_multi_value(row["expected_entities"]),
            safety_level=row["safety_level"].strip(),
            query_string=row["query_string"].strip(),
        )


@dataclass(frozen=True)
class RawCandidate:
    """Source-level candidate with query provenance and source metadata."""

    source: str
    source_id: str
    source_type: str
    title: str
    source_url: str
    topic_track: str
    query_id: str
    query_variant: str
    query_purpose: str
    platform: str
    expected_entities: tuple[str, ...]
    safety_level: str
    authors: tuple[str, ...] = ()
    venue: str = ""
    year: int | None = None
    doi: str = ""
    arxiv_id: str = ""
    abstract: str = ""
    keywords: tuple[str, ...] = ()
    citation_count: int | None = None
    raw: Mapping[str, Any] = field(default_factory=dict, repr=False, compare=False)

    def __post_init__(self) -> None:
        _require_stripped_text(
            self,
            (
                "source",
                "source_id",
                "source_type",
                "title",
                "source_url",
                "topic_track",
                "query_id",
                "query_variant",
                "query_purpose",
                "platform",
                "safety_level",
            ),
            "RawCandidate",
        )
        if not SOURCE_NAME_PATTERN.fullmatch(self.source):
            raise ValueError(f"invalid candidate source: {self.source!r}")
        if not self.source_id.startswith(f"{self.source}:"):
            raise ValueError("candidate source_id must be namespaced by source")
        if self.source_type not in SOURCE_TYPES:
            raise ValueError(f"unsupported candidate source_type: {self.source_type!r}")
        parsed_url = urlparse(self.source_url)
        if parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
            raise ValueError(
                f"candidate source_url is not HTTP(S): {self.source_url!r}"
            )
        if self.topic_track not in TRACK_PREFIXES:
            raise ValueError(f"unsupported candidate topic_track: {self.topic_track!r}")
        _validate_entity_roles(
            self.expected_entities, label="candidate expected_entities"
        )
        if self.safety_level not in SAFETY_LEVELS:
            raise ValueError(
                f"unsupported candidate safety_level: {self.safety_level!r}"
            )
        _validate_optional_int(self.year, label="candidate year")
        if self.year is not None and not 1000 <= self.year <= 9999:
            raise ValueError(f"candidate year is out of range: {self.year!r}")
        _validate_optional_int(self.citation_count, label="candidate citation_count")
        if self.citation_count is not None and self.citation_count < 0:
            raise ValueError("candidate citation_count must be non-negative")


@dataclass(frozen=True)
class SourceParseResult:
    source: str
    query: SourceQuery
    hit_count: int
    candidates: tuple[RawCandidate, ...]

    def __post_init__(self) -> None:
        if not SOURCE_NAME_PATTERN.fullmatch(self.source):
            raise ValueError(f"invalid parse-result source: {self.source!r}")
        _validate_hit_count(self.hit_count, exported_count=len(self.candidates))
        for candidate in self.candidates:
            _validate_candidate_provenance(
                candidate, source=self.source, query=self.query
            )

    @property
    def exported_count(self) -> int:
        return len(self.candidates)


def load_json_object(text: str, *, source: str) -> Mapping[str, Any]:
    def reject_non_finite(value: str) -> None:
        raise SourceParseError(f"{source}: non-finite JSON value {value!r}")

    try:
        payload = json.loads(text, parse_constant=reject_non_finite)
    except json.JSONDecodeError as exc:
        raise SourceParseError(f"{source}: invalid JSON response") from exc
    if not isinstance(payload, Mapping):
        raise SourceParseError(f"{source}: response root must be an object")
    return payload


def normalize_space(value: object) -> str:
    if value is None or isinstance(value, bool):
        return ""
    if not isinstance(value, (str, int, float)):
        return ""
    return " ".join(str(value).split())


def first_text(value: object) -> str:
    if isinstance(value, list):
        return normalize_space(value[0]) if value else ""
    return normalize_space(value)


def parse_int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and re.fullmatch(r"[+-]?\d+", value.strip()):
        return int(value)
    return None


def required_nonnegative_int(value: object, *, label: str) -> int:
    parsed = parse_int(value)
    if parsed is None or parsed < 0:
        raise SourceParseError(f"{label} must be a non-negative integer")
    return parsed


def split_multi_value(value: object) -> tuple[str, ...]:
    text = normalize_space(value)
    if not text:
        return ()
    separator = ";" if ";" in text else "|" if "|" in text else None
    parts = text.split(separator) if separator else [text]
    return tuple(item.strip() for item in parts if item.strip())


def normalize_doi(value: object) -> str:
    doi = normalize_space(value).lower()
    doi = re.sub(r"^(?:https?://(?:dx\.)?doi\.org/|doi:\s*)", "", doi)
    return doi


def normalize_arxiv_id(value: object) -> str:
    arxiv_id = normalize_space(value)
    arxiv_id = re.sub(
        r"^(?:https?://arxiv\.org/(?:abs|pdf)/|arxiv:\s*)",
        "",
        arxiv_id,
        flags=re.IGNORECASE,
    )
    arxiv_id = re.sub(r"\.pdf$", "", arxiv_id, flags=re.IGNORECASE)
    return re.sub(r"v\d+$", "", arxiv_id, flags=re.IGNORECASE)


def source_id(
    source: str,
    external_id: object = "",
    *,
    doi: str = "",
    arxiv_id: str = "",
    source_url: str = "",
    title: str = "",
    year: int | None = None,
) -> str:
    identifier = normalize_space(external_id)
    prefix = f"{source}:"
    if identifier:
        return identifier if identifier.startswith(prefix) else f"{prefix}{identifier}"
    if doi:
        return f"{prefix}doi:{doi}"
    if arxiv_id:
        return f"{prefix}arxiv:{arxiv_id}"
    fingerprint = "\x1f".join((source_url, title.casefold(), str(year or "")))
    if not source_url and not title:
        raise ValueError(f"{source}: cannot construct a stable source_id")
    digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:20]
    return f"{prefix}record:{digest}"


def canonical_source_url(
    value: object,
    *,
    doi: str = "",
    arxiv_id: str = "",
) -> str:
    url = normalize_space(value)
    if url:
        return url
    if doi:
        return f"https://doi.org/{doi}"
    if arxiv_id:
        return f"https://arxiv.org/abs/{arxiv_id}"
    return ""


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def strip_markup(value: object) -> str:
    parser = _TextExtractor()
    parser.feed(normalize_space(value))
    parser.close()
    return normalize_space(" ".join(parser.parts))
