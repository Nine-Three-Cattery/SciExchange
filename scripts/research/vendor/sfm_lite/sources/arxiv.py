from __future__ import annotations

import xml.etree.ElementTree as ET
from collections.abc import Mapping, Sequence

from .common import (
    RawCandidate,
    SourceParseError,
    SourceParseResult,
    SourceQuery,
    canonical_source_url,
    normalize_arxiv_id,
    normalize_doi,
    normalize_space,
    parse_int,
    required_nonnegative_int,
    source_id,
)


ATOM_NS = "{http://www.w3.org/2005/Atom}"
ARXIV_NS = "{http://arxiv.org/schemas/atom}"
OPENSEARCH_NS = "{http://a9.com/-/spec/opensearch/1.1/}"


class ArxivAdapter:
    """Parse an arXiv Atom response without performing network I/O."""

    source = "arxiv"

    def parse_response(
        self,
        text: str,
        query: SourceQuery,
        *,
        hit_count_only: bool = False,
    ) -> SourceParseResult:
        lowered = text.casefold()
        if "<!doctype" in lowered or "<!entity" in lowered:
            raise SourceParseError("arxiv: XML declarations with entities are rejected")
        try:
            root = ET.fromstring(text)
        except ET.ParseError as exc:
            raise SourceParseError("arxiv: invalid Atom XML response") from exc
        if root.tag != f"{ATOM_NS}feed":
            raise SourceParseError("arxiv: response root must be an Atom feed")

        total = required_nonnegative_int(
            _find_text(root, f"{OPENSEARCH_NS}totalResults"),
            label="arxiv: totalResults",
        )
        all_entries = root.findall(f"{ATOM_NS}entry")
        _reject_api_error_entries(all_entries)
        entries = () if hit_count_only else all_entries
        candidates = _parse_entries(entries, query)
        return SourceParseResult(
            source=self.source,
            query=query,
            hit_count=total,
            candidates=candidates,
        )


def _find_text(element: ET.Element, path: str) -> str:
    child = element.find(path)
    return normalize_space(child.text if child is not None else "")


def _parse_entries(
    entries: Sequence[ET.Element], query: SourceQuery
) -> tuple[RawCandidate, ...]:
    candidates: list[RawCandidate] = []
    for index, entry in enumerate(entries, start=1):
        try:
            candidates.append(_entry_to_candidate(entry, query))
        except (TypeError, ValueError) as exc:
            raise SourceParseError(f"arxiv: invalid entry {index}: {exc}") from exc
    return tuple(candidates)


def _reject_api_error_entries(entries: Sequence[ET.Element]) -> None:
    for entry in entries:
        identifier = _find_text(entry, f"{ATOM_NS}id")
        title = _find_text(entry, f"{ATOM_NS}title")
        if "/api/errors#" not in identifier:
            continue
        summary = _find_text(entry, f"{ATOM_NS}summary")
        raise SourceParseError(f"arxiv: API error: {summary or identifier or title}")


def _entry_to_candidate(entry: ET.Element, query: SourceQuery) -> RawCandidate:
    atom_id = _find_text(entry, f"{ATOM_NS}id")
    arxiv_id = normalize_arxiv_id(atom_id)
    doi = normalize_doi(_find_text(entry, f"{ARXIV_NS}doi"))
    published = _find_text(entry, f"{ATOM_NS}published")
    title = _find_text(entry, f"{ATOM_NS}title")
    url = canonical_source_url(atom_id, doi=doi, arxiv_id=arxiv_id)
    authors = tuple(
        name
        for author in entry.findall(f"{ATOM_NS}author")
        if (name := normalize_space(author.findtext(f"{ATOM_NS}name", default="")))
    )
    keywords = tuple(
        term
        for category in entry.findall(f"{ATOM_NS}category")
        if (term := normalize_space(category.attrib.get("term", "")))
    )
    raw: Mapping[str, object] = {
        "id": atom_id,
        "published": published,
        "updated": _find_text(entry, f"{ATOM_NS}updated"),
        "categories": keywords,
    }
    return RawCandidate(
        source="arxiv",
        source_id=source_id(
            "arxiv",
            arxiv_id,
            doi=doi,
            source_url=url,
            title=title,
            year=parse_int(published[:4]),
        ),
        source_type="preprint",
        title=title,
        source_url=url,
        topic_track=query.topic_track,
        query_id=query.query_id,
        query_variant=query.query_variant,
        query_purpose=query.query_purpose,
        platform=query.platform,
        expected_entities=query.expected_entities,
        safety_level=query.safety_level,
        authors=authors,
        year=parse_int(published[:4]),
        doi=doi,
        arxiv_id=arxiv_id,
        abstract=_find_text(entry, f"{ATOM_NS}summary"),
        keywords=keywords,
        raw=raw,
    )
