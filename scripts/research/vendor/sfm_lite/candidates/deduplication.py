from __future__ import annotations

import hashlib
from collections import Counter, defaultdict
from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, replace
from itertools import combinations
from typing import Final

from ..sources import RawCandidate
from .normalization import NormalizedCandidate, normalize_candidates

DEDUP_REASONS: Final = frozenset(
    {"source_id_exact", "doi_exact", "arxiv_exact", "title_author_year_exact"}
)
REVIEW_REASONS: Final = frozenset(
    {"identity_conflict", "cross_track_title_match", "ambiguous_title_cluster"}
)
SIGNAL_STRENGTH: Final = {
    "source_id_exact": 0,
    "doi_exact": 1,
    "arxiv_exact": 2,
    "title_author_year_exact": 3,
}
GROUP_REVIEW_REASONS: Final = frozenset(
    {
        "canonical_id_conflict",
        "cross_track_primary_unresolved",
        "identity_conflict",
        "invalid_identity_metadata",
    }
)


@dataclass(frozen=True)
class DedupReview:
    """A plausible pair intentionally withheld from automatic merging."""

    candidate_ids: tuple[str, str]
    reason: str
    matching_signal: str
    conflicting_fields: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        if self.reason not in REVIEW_REASONS:
            raise ValueError(f"unsupported review reason: {self.reason!r}")
        if self.matching_signal not in DEDUP_REASONS:
            raise ValueError(f"unsupported matching signal: {self.matching_signal!r}")
        if len(self.candidate_ids) != 2 or not all(self.candidate_ids):
            raise ValueError("candidate_ids must contain two non-empty IDs")
        if len(set(self.candidate_ids)) != 2:
            raise ValueError("candidate_ids must identify two distinct records")
        if self.candidate_ids != tuple(sorted(self.candidate_ids)):
            raise ValueError("candidate_ids must be sorted")
        if set(self.conflicting_fields) - {"doi_normalized", "arxiv_id_normalized"}:
            raise ValueError(
                f"unsupported conflicting fields: {self.conflicting_fields!r}"
            )
        if self.conflicting_fields != tuple(sorted(set(self.conflicting_fields))):
            raise ValueError("conflicting_fields must be sorted and unique")
        if (self.reason == "identity_conflict") != bool(self.conflicting_fields):
            raise ValueError("identity conflicts must identify conflicting fields")
        if (
            self.reason in {"cross_track_title_match", "ambiguous_title_cluster"}
            and self.matching_signal != "title_author_year_exact"
        ):
            raise ValueError("title review reasons require a title matching signal")


@dataclass(frozen=True)
class DedupGroup:
    canonical_id: str
    representative: NormalizedCandidate
    members: tuple[NormalizedCandidate, ...]
    reasons: tuple[str, ...]
    source_ids: tuple[str, ...]
    query_ids: tuple[str, ...]
    topic_tracks: tuple[str, ...]
    expected_entities: tuple[str, ...]
    primary_track: str | None
    needs_review: bool
    review_reasons: tuple[str, ...]

    def __post_init__(self) -> None:
        if not self.canonical_id or not self.members:
            raise ValueError("dedup group must have an ID and at least one member")
        if self.representative not in self.members:
            raise ValueError("representative must be a group member")
        if set(self.reasons) - DEDUP_REASONS:
            raise ValueError(f"unsupported dedup reasons: {self.reasons!r}")
        if self.reasons != tuple(sorted(set(self.reasons))):
            raise ValueError("dedup reasons must be sorted and unique")
        expected_primary = self.topic_tracks[0] if len(self.topic_tracks) == 1 else None
        if self.primary_track != expected_primary:
            raise ValueError(
                "primary_track must remain unresolved for cross-track groups"
            )
        if self.needs_review != bool(self.review_reasons):
            raise ValueError("needs_review must reflect review_reasons")
        if set(self.review_reasons) - GROUP_REVIEW_REASONS:
            raise ValueError(
                f"unsupported group review reasons: {self.review_reasons!r}"
            )
        if self.review_reasons != tuple(sorted(set(self.review_reasons))):
            raise ValueError("group review reasons must be sorted and unique")
        for label, values in (
            ("source_ids", self.source_ids),
            ("query_ids", self.query_ids),
            ("topic_tracks", self.topic_tracks),
            ("expected_entities", self.expected_entities),
        ):
            if not values or values != tuple(sorted(set(values))):
                raise ValueError(f"{label} must be non-empty, sorted, and unique")

    @property
    def duplicate_count(self) -> int:
        return len(self.members)


@dataclass(frozen=True)
class DeduplicationResult:
    groups: tuple[DedupGroup, ...]
    reviews: tuple[DedupReview, ...]

    def __post_init__(self) -> None:
        expected_groups = tuple(
            sorted(self.groups, key=lambda group: group.canonical_id)
        )
        if self.groups != expected_groups:
            raise ValueError("dedup groups must be sorted by canonical_id")
        canonical_ids = tuple(group.canonical_id for group in self.groups)
        if len(canonical_ids) != len(set(canonical_ids)):
            raise ValueError("dedup groups must have unique canonical IDs")

        group_id_by_source: dict[str, str] = {}
        for group in self.groups:
            for source_id in group.source_ids:
                if source_id in group_id_by_source:
                    raise ValueError(
                        "source IDs must belong to exactly one dedup group"
                    )
                group_id_by_source[source_id] = group.canonical_id

        expected_reviews = tuple(sorted(set(self.reviews), key=dedup_review_sort_key))
        if self.reviews != expected_reviews:
            raise ValueError("dedup reviews must be sorted and unique")
        for review in self.reviews:
            try:
                group_ids = {
                    group_id_by_source[source_id] for source_id in review.candidate_ids
                }
            except KeyError as error:
                raise ValueError(
                    "dedup reviews must reference known source IDs"
                ) from error
            if len(group_ids) != 2:
                raise ValueError("each pair review must link two distinct dedup groups")


class _DisjointSets:
    def __init__(self, size: int) -> None:
        self.parent = list(range(size))
        self._members = [{index} for index in range(size)]

    def find(self, index: int) -> int:
        while self.parent[index] != index:
            self.parent[index] = self.parent[self.parent[index]]
            index = self.parent[index]
        return index

    def union(self, left: int, right: int) -> tuple[int, int, int]:
        left_root = self.find(left)
        right_root = self.find(right)
        root = min(left_root, right_root)
        other = max(left_root, right_root)
        self.parent[other] = root
        self._members[root].update(self._members[other])
        self._members[other].clear()
        return root, left_root, right_root

    def members(self, root: int) -> tuple[int, ...]:
        return tuple(sorted(self._members[self.find(root)]))


def deduplicate_candidates(candidates: Sequence[RawCandidate]) -> DeduplicationResult:
    normalized = tuple(sorted(normalize_candidates(candidates), key=_candidate_key))
    sets = _DisjointSets(len(normalized))
    reasons: dict[int, set[str]] = defaultdict(set)
    flags: dict[int, set[str]] = defaultdict(set)
    reviews: dict[tuple[object, ...], DedupReview] = {}

    for left, right, signal in _candidate_pairs(normalized):
        _consider_pair(
            normalized,
            sets,
            reasons,
            flags,
            reviews,
            left=left,
            right=right,
            signal=signal,
        )

    grouped: dict[int, list[NormalizedCandidate]] = defaultdict(list)
    for index, candidate in enumerate(normalized):
        grouped[sets.find(index)].append(candidate)

    groups = tuple(
        _build_group(members, reasons[root], flags[root])
        for root, members in sorted(
            grouped.items(), key=lambda item: _candidate_key(item[1][0])
        )
    )
    groups = _disambiguate_canonical_ids(groups)
    return DeduplicationResult(
        groups=tuple(sorted(groups, key=lambda group: group.canonical_id)),
        reviews=tuple(sorted(reviews.values(), key=dedup_review_sort_key)),
    )


def _candidate_pairs(
    candidates: Sequence[NormalizedCandidate],
) -> Iterable[tuple[int, int, str]]:
    for attribute, reason in (
        ("source_id", "source_id_exact"),
        ("doi_normalized", "doi_exact"),
        ("arxiv_id_normalized", "arxiv_exact"),
    ):
        yield from _exact_pairs(candidates, attribute=attribute, reason=reason)
    yield from _title_pairs(candidates)


def _exact_pairs(
    candidates: Sequence[NormalizedCandidate], *, attribute: str, reason: str
) -> Iterable[tuple[int, int, str]]:
    indexes_by_value: dict[str, list[int]] = defaultdict(list)
    for index, candidate in enumerate(candidates):
        value = getattr(candidate, attribute)
        if value:
            indexes_by_value[value].append(index)
    for indexes in indexes_by_value.values():
        for left, right in combinations(indexes, 2):
            yield left, right, reason


def _title_pairs(
    candidates: Sequence[NormalizedCandidate],
) -> Iterable[tuple[int, int, str]]:
    indexes_by_identity: dict[tuple[str, int, str], list[int]] = defaultdict(list)
    for index, candidate in enumerate(candidates):
        year = candidate.candidate.year
        if candidate.title_key and year is not None and candidate.author_keys:
            for author_key in candidate.author_keys:
                indexes_by_identity[(candidate.title_key, year, author_key)].append(
                    index
                )
    candidate_pairs: set[tuple[int, int]] = set()
    for indexes in indexes_by_identity.values():
        for left, right in combinations(indexes, 2):
            candidate_pairs.add((left, right))
    for left, right in sorted(candidate_pairs):
        if _artifacts_compatible(candidates[left], candidates[right]):
            yield left, right, "title_author_year_exact"


def _consider_pair(
    candidates: Sequence[NormalizedCandidate],
    sets: _DisjointSets,
    reasons: dict[int, set[str]],
    flags: dict[int, set[str]],
    reviews: dict[tuple[object, ...], DedupReview],
    *,
    left: int,
    right: int,
    signal: str,
) -> None:
    left_root = sets.find(left)
    right_root = sets.find(right)
    if left_root == right_root:
        return

    left_group = _root_members(candidates, sets, left_root)
    right_group = _root_members(candidates, sets, right_root)
    conflicting_fields = _identity_conflicts(left_group, right_group)
    if conflicting_fields and signal != "source_id_exact":
        _add_review(
            reviews,
            candidates[left],
            candidates[right],
            reason="identity_conflict",
            signal=signal,
            conflicting_fields=conflicting_fields,
        )
        return

    if signal == "title_author_year_exact" and not _title_groups_compatible(
        left_group, right_group
    ):
        if len({item.topic_track for item in (*left_group, *right_group)}) > 1:
            _add_review(
                reviews,
                candidates[left],
                candidates[right],
                reason="cross_track_title_match",
                signal=signal,
            )
        else:
            _add_review(
                reviews,
                candidates[left],
                candidates[right],
                reason="ambiguous_title_cluster",
                signal=signal,
            )
        return

    root, old_left, old_right = sets.union(left_root, right_root)
    merged_reasons = (
        reasons.pop(old_left, set()) | reasons.pop(old_right, set()) | {signal}
    )
    merged_flags = flags.pop(old_left, set()) | flags.pop(old_right, set())
    if conflicting_fields:
        merged_flags.add("identity_conflict")
    reasons[root] = merged_reasons
    flags[root] = merged_flags


def _root_members(
    candidates: Sequence[NormalizedCandidate], sets: _DisjointSets, root: int
) -> tuple[NormalizedCandidate, ...]:
    return tuple(candidates[index] for index in sets.members(root))


def _identity_conflicts(
    left: Sequence[NormalizedCandidate], right: Sequence[NormalizedCandidate]
) -> tuple[str, ...]:
    conflicts: list[str] = []
    for attribute in ("doi_normalized", "arxiv_id_normalized"):
        values = {getattr(item, attribute) for item in (*left, *right)} - {""}
        if len(values) > 1:
            conflicts.append(attribute)
    return tuple(conflicts)


def _title_groups_compatible(
    left: Sequence[NormalizedCandidate], right: Sequence[NormalizedCandidate]
) -> bool:
    combined = (*left, *right)
    first = combined[0]
    shared_authors = set(first.author_keys).intersection(
        *(set(item.author_keys) for item in combined[1:])
    )
    return bool(shared_authors) and all(
        item.title_key == first.title_key
        and item.candidate.year == first.candidate.year
        and item.topic_track == first.topic_track
        and _artifacts_compatible(first, item)
        for item in combined[1:]
    )


def _artifacts_compatible(
    left: NormalizedCandidate, right: NormalizedCandidate
) -> bool:
    scholarly_types = {"paper", "preprint"}
    return (
        left.artifact_type in scholarly_types and right.artifact_type in scholarly_types
    )


def _add_review(
    reviews: dict[tuple[object, ...], DedupReview],
    left: NormalizedCandidate,
    right: NormalizedCandidate,
    *,
    reason: str,
    signal: str,
    conflicting_fields: tuple[str, ...] = (),
) -> None:
    first_id, second_id = sorted((left.source_id, right.source_id))
    candidate_ids = (first_id, second_id)
    review = DedupReview(
        candidate_ids=candidate_ids,
        reason=reason,
        matching_signal=signal,
        conflicting_fields=conflicting_fields,
    )
    key = (candidate_ids, reason, conflicting_fields)
    existing = reviews.get(key)
    if (
        existing is None
        or SIGNAL_STRENGTH[signal] < SIGNAL_STRENGTH[existing.matching_signal]
    ):
        reviews[key] = review


def _build_group(
    members: Sequence[NormalizedCandidate], reasons: set[str], flags: set[str]
) -> DedupGroup:
    ordered = tuple(sorted(members, key=_candidate_key))
    representative = min(ordered, key=_representative_rank)
    topic_tracks = _collect(ordered, lambda item: item.topic_track)
    review_reasons = set(flags)
    if len(topic_tracks) > 1:
        review_reasons.add("cross_track_primary_unresolved")
    if any(item.identity_warnings for item in ordered):
        review_reasons.add("invalid_identity_metadata")
    return DedupGroup(
        canonical_id=_canonical_id(ordered, reasons),
        representative=representative,
        members=ordered,
        reasons=tuple(sorted(reasons)),
        source_ids=_collect(ordered, lambda item: item.source_id),
        query_ids=_collect(ordered, lambda item: item.candidate.query_id),
        topic_tracks=topic_tracks,
        expected_entities=_collect_many(
            ordered, lambda item: item.candidate.expected_entities
        ),
        primary_track=topic_tracks[0] if len(topic_tracks) == 1 else None,
        needs_review=bool(review_reasons),
        review_reasons=tuple(sorted(review_reasons)),
    )


def _canonical_id(members: Sequence[NormalizedCandidate], reasons: set[str]) -> str:
    dois = _collect(members, lambda item: item.doi_normalized)
    if len(dois) == 1:
        return f"doi:{dois[0]}"
    arxiv_ids = _collect(members, lambda item: item.arxiv_id_normalized)
    if len(arxiv_ids) == 1:
        return f"arxiv:{arxiv_ids[0]}"
    if "title_author_year_exact" in reasons:
        first = members[0]
        shared_authors = set(first.author_keys).intersection(
            *(set(item.author_keys) for item in members[1:])
        )
        fingerprint = "\x1f".join(
            (
                first.title_key,
                str(first.candidate.year),
                ";".join(sorted(shared_authors)),
            )
        )
        digest = hashlib.sha256(fingerprint.encode("utf-8")).hexdigest()[:20]
        return f"title_author_year:{digest}"
    return f"source:{members[0].source_id}"


def _disambiguate_canonical_ids(
    groups: tuple[DedupGroup, ...],
) -> tuple[DedupGroup, ...]:
    counts = Counter(group.canonical_id for group in groups)
    disambiguated: list[DedupGroup] = []
    for group in groups:
        if counts[group.canonical_id] == 1:
            disambiguated.append(group)
            continue
        digest = hashlib.sha256(
            "\x1f".join(group.source_ids).encode("utf-8")
        ).hexdigest()[:12]
        review_reasons = tuple(sorted({*group.review_reasons, "canonical_id_conflict"}))
        disambiguated.append(
            replace(
                group,
                canonical_id=f"{group.canonical_id}:conflict:{digest}",
                needs_review=True,
                review_reasons=review_reasons,
            )
        )
    return tuple(disambiguated)


def _representative_rank(candidate: NormalizedCandidate) -> tuple[object, ...]:
    source_type_rank = {"paper": 0, "preprint": 1}.get(
        candidate.candidate.source_type, 2
    )
    metadata_count = sum(
        bool(value)
        for value in (
            candidate.doi_normalized,
            candidate.arxiv_id_normalized,
            candidate.candidate.authors,
            candidate.candidate.venue,
            candidate.candidate.year,
            candidate.candidate.abstract,
            candidate.candidate.keywords,
            candidate.candidate.citation_count,
        )
    )
    return (
        source_type_rank,
        -metadata_count,
        _candidate_key(candidate),
    )


def _candidate_key(candidate: NormalizedCandidate) -> tuple[object, ...]:
    return (
        candidate.source_id,
        candidate.candidate.query_id,
        candidate.topic_track,
        candidate.doi_normalized,
        candidate.arxiv_id_normalized,
        candidate.title_key,
        candidate.candidate.year or 0,
        candidate.author_keys,
        candidate.candidate.source_url,
    )


def _collect(
    candidates: Sequence[NormalizedCandidate],
    getter: Callable[[NormalizedCandidate], str],
) -> tuple[str, ...]:
    values = {getter(candidate) for candidate in candidates}
    return tuple(sorted(value for value in values if isinstance(value, str) and value))


def _collect_many(
    candidates: Sequence[NormalizedCandidate],
    getter: Callable[[NormalizedCandidate], Sequence[str]],
) -> tuple[str, ...]:
    values = {
        value
        for candidate in candidates
        for value in getter(candidate)
        if isinstance(value, str) and value
    }
    return tuple(sorted(values))


def dedup_review_sort_key(review: DedupReview) -> tuple[object, ...]:
    """Order pair reviews deterministically.

    Public because screening sorts the same reviews and had a byte-identical
    copy of this; the ordering has to agree or the two modules disagree about
    whether a review list is already sorted.
    """
    return (
        review.candidate_ids,
        review.reason,
        review.matching_signal,
        review.conflicting_fields,
    )
