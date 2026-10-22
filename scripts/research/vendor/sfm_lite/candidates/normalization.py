from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Final

from ..sources import RawCandidate
from ..sources.common import normalize_arxiv_id, normalize_doi

DOI_PATTERN: Final = re.compile(r"^10\.\d{4,9}/\S+$", re.IGNORECASE)
ARXIV_ID_PATTERN: Final = re.compile(
    r"(?:\d{4}\.\d{4,5}|[a-z][a-z0-9.-]*/\d{7})", re.IGNORECASE
)
SOURCE_TO_ARTIFACT_TYPE: Final = {
    "paper": "paper",
    "preprint": "preprint",
    "model_card": "model",
    "dataset_card": "dataset",
    "benchmark_page": "benchmark",
    "repo": "repo",
    "tool": "tool",
    "website": "website",
}
ARTIFACT_TYPES: Final = frozenset(
    {
        "paper",
        "preprint",
        "model",
        "representation",
        "dataset",
        "benchmark",
        "repo",
        "tool",
        "judge",
        "guardrail",
        "risk_context",
        "website",
        "unknown",
    }
)
IDENTITY_WARNING_CODES: Final = frozenset(
    {"invalid_doi", "invalid_arxiv_id", "empty_title_key"}
)


@dataclass(frozen=True)
class NormalizedCandidate:
    """A raw candidate plus deterministic keys used only for identity matching."""

    candidate: RawCandidate
    doi_normalized: str
    arxiv_id_normalized: str
    title_key: str
    author_keys: tuple[str, ...]
    artifact_type: str
    identity_warnings: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        unsupported = set(self.identity_warnings) - IDENTITY_WARNING_CODES
        if unsupported:
            raise ValueError(f"unsupported identity warnings: {sorted(unsupported)!r}")
        if len(self.identity_warnings) != len(set(self.identity_warnings)):
            raise ValueError("identity_warnings must not contain duplicates")
        if self.artifact_type not in ARTIFACT_TYPES:
            raise ValueError(f"unsupported artifact_type: {self.artifact_type!r}")
        if self.doi_normalized and not DOI_PATTERN.fullmatch(self.doi_normalized):
            raise ValueError("doi_normalized must be empty or a normalized DOI")
        if self.arxiv_id_normalized and not ARXIV_ID_PATTERN.fullmatch(
            self.arxiv_id_normalized
        ):
            raise ValueError(
                "arxiv_id_normalized must be empty or a normalized arXiv ID"
            )
        if len(self.author_keys) != len(set(self.author_keys)):
            raise ValueError("author_keys must not contain duplicates")

    @property
    def source_id(self) -> str:
        return self.candidate.source_id

    @property
    def topic_track(self) -> str:
        return self.candidate.topic_track


def normalize_candidate(candidate: RawCandidate) -> NormalizedCandidate:
    doi_normalized = normalize_doi(candidate.doi)
    arxiv_id_normalized = normalize_arxiv_id(candidate.arxiv_id).casefold()
    title_key = _text_key(candidate.title)
    warnings: list[str] = []

    if doi_normalized and not DOI_PATTERN.fullmatch(doi_normalized):
        warnings.append("invalid_doi")
        doi_normalized = ""
    if arxiv_id_normalized and not ARXIV_ID_PATTERN.fullmatch(arxiv_id_normalized):
        warnings.append("invalid_arxiv_id")
        arxiv_id_normalized = ""
    if not title_key:
        warnings.append("empty_title_key")

    author_keys = _unique_preserving_order(
        key for author in candidate.authors if (key := _author_key(author))
    )
    return NormalizedCandidate(
        candidate=candidate,
        doi_normalized=doi_normalized,
        arxiv_id_normalized=arxiv_id_normalized,
        title_key=title_key,
        author_keys=author_keys,
        artifact_type=SOURCE_TO_ARTIFACT_TYPE.get(candidate.source_type, "unknown"),
        identity_warnings=tuple(warnings),
    )


def normalize_candidates(
    candidates: Sequence[RawCandidate],
) -> tuple[NormalizedCandidate, ...]:
    return tuple(normalize_candidate(candidate) for candidate in candidates)


def _text_key(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value).casefold().replace("_", " ")
    return " ".join(re.findall(r"[^\W_]+|[+#]+", normalized, flags=re.UNICODE))


def _author_key(value: str) -> str:
    parts = value.split(",", maxsplit=1)
    if len(parts) == 2:
        family_name = _text_key(parts[0])
        given_names = _text_key(parts[1])
        if family_name and given_names:
            return f"{given_names} {family_name}"
    return _text_key(value)


def _unique_preserving_order(values: Iterable[str]) -> tuple[str, ...]:
    unique: list[str] = []
    for value in values:
        if value not in unique:
            unique.append(value)
    return tuple(unique)
