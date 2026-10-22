from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from .common import (
    RawCandidate,
    SourceParseError,
    SourceParseResult,
    SourceQuery,
    canonical_source_url,
    first_text,
    load_json_object,
    normalize_doi,
    normalize_space,
    parse_int,
    required_nonnegative_int,
    source_id,
    strip_markup,
)


class CrossrefAdapter:
    """Parse Crossref metadata responses; it is not a discovery-query client."""

    source = "crossref"

    def parse_response(
        self,
        text: str,
        query: SourceQuery,
        *,
        hit_count_only: bool = False,
    ) -> SourceParseResult:
        payload = load_json_object(text, source=self.source)
        message = payload.get("message", {})
        if message is None:
            message = {}
        if not isinstance(message, Mapping):
            raise SourceParseError("crossref: message must be an object")
        is_single_work = "items" not in message and bool(
            message.get("DOI") or message.get("title")
        )
        raw_items = [message] if is_single_work else message.get("items", [])
        raw_items = [] if raw_items is None else raw_items
        if not isinstance(raw_items, list) or not all(
            isinstance(item, Mapping) for item in raw_items
        ):
            raise SourceParseError("crossref: items must be a list of objects")
        items = () if hit_count_only else raw_items
        candidates = _parse_items(items, query)
        hit_count = (
            1
            if is_single_work
            else required_nonnegative_int(
                message.get("total-results"), label="crossref: total-results"
            )
        )
        return SourceParseResult(
            source=self.source,
            query=query,
            hit_count=hit_count,
            candidates=candidates,
        )


def _parse_items(
    items: Sequence[Mapping[str, Any]], query: SourceQuery
) -> tuple[RawCandidate, ...]:
    candidates: list[RawCandidate] = []
    for index, item in enumerate(items, start=1):
        try:
            candidates.append(_item_to_candidate(item, query))
        except (TypeError, ValueError) as exc:
            raise SourceParseError(f"crossref: invalid item {index}: {exc}") from exc
    return tuple(candidates)


def _item_to_candidate(item: Mapping[str, Any], query: SourceQuery) -> RawCandidate:
    doi = normalize_doi(item.get("DOI"))
    title = first_text(item.get("title"))
    year = _issued_year(item)
    url = canonical_source_url(item.get("URL"), doi=doi)
    return RawCandidate(
        source="crossref",
        source_id=source_id(
            "crossref",
            doi,
            doi=doi,
            source_url=url,
            title=title,
            year=year,
        ),
        source_type=_source_type(item),
        title=title,
        source_url=url,
        topic_track=query.topic_track,
        query_id=query.query_id,
        query_variant=query.query_variant,
        query_purpose=query.query_purpose,
        platform=query.platform,
        expected_entities=query.expected_entities,
        safety_level=query.safety_level,
        authors=_authors(item),
        venue=first_text(item.get("container-title")),
        year=year,
        doi=doi,
        abstract=strip_markup(first_text(item.get("abstract"))),
        citation_count=parse_int(item.get("is-referenced-by-count")),
        raw=item,
    )


def _authors(item: Mapping[str, Any]) -> tuple[str, ...]:
    raw_authors = item.get("author") or []
    if not isinstance(raw_authors, list):
        return ()
    names: list[str] = []
    for author in raw_authors:
        if not isinstance(author, Mapping):
            continue
        name = normalize_space(
            f"{normalize_space(author.get('given'))} {normalize_space(author.get('family'))}"
        )
        if name:
            names.append(name)
    return tuple(names)


def _issued_year(item: Mapping[str, Any]) -> int | None:
    for key in ("issued", "published-print", "published-online", "created"):
        value = item.get(key) or {}
        if not isinstance(value, Mapping):
            continue
        date_parts = value.get("date-parts") or []
        if (
            isinstance(date_parts, list)
            and date_parts
            and isinstance(date_parts[0], list)
            and date_parts[0]
        ):
            return parse_int(date_parts[0][0])
    return None


def _source_type(item: Mapping[str, Any]) -> str:
    item_type = normalize_space(item.get("type")).casefold()
    if item_type == "posted-content":
        return "preprint"
    if item_type in {
        "book",
        "book-chapter",
        "dissertation",
        "journal-article",
        "monograph",
        "proceedings-article",
        "report",
        "standard",
    }:
        return "paper"
    return "unknown"
