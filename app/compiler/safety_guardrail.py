"""Protocol-scoped CWC keyword screening and untrusted text quarantine.

This is a deterministic metadata screen, not a complete chemical hazard model.
Quarantined strings are removed from the sanitized object; they are never
interpreted as instructions or passed to an LLM by this module.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SafetyAlert(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    type: str
    severity: str
    rule: str
    path: str
    action: str = "QUARANTINED"


class SafetyCheckResult(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    safe: bool
    alerts: list[SafetyAlert] = Field(default_factory=list)
    sanitized_content: Any
    screening_scope: str = "v4 named CWC families, representative precursors, and instruction patterns"


# Names and CAS identifiers only: no synthesis instructions or precursor recipes.
# Schedules identify the screening dictionary category, not a legal conclusion.
_CWC_RULES: tuple[tuple[str, str], ...] = (
    ("SCHEDULE_1_NERVE_AGENTS", r"\b(?:sarin|soman|tabun|VX|novichok|A[- ]?23[024])\b|沙林|梭曼|塔崩|诺维乔克|\b(?:107-44-8|96-64-0|77-81-6|50782-69-9)\b"),
    ("SCHEDULE_1_AGENT_FAMILY", r"\bo[- ]alkyl\s+alkylphosphonofluoridate\b"),
    ("SCHEDULE_1_BLISTER_AGENTS", r"\b(?:(?:sulfur|sulphur|nitrogen)\s+mustard|mustard\s+(?:agent|gas)|lewisite|HN[- ]?[123])\b|芥子气|路易氏剂|\b(?:505-60-2|541-25-3|538-07-8|51-75-2|555-77-1)\b"),
    ("SCHEDULE_1_TOXINS", r"\b(?:ricin|saxitoxin)\b|蓖麻毒素|石房蛤毒素|\b(?:9009-86-3|35523-89-8)\b"),
    ("SCHEDULE_2_PRECURSORS", r"\b(?:dimethyl\s+methylphosphonate|methylphosphonyl\s+dichloride|thiodiglycol|3-quinuclidinol)\b|\b(?:756-79-6|676-97-1|111-48-8|1619-34-7)\b"),
    ("SCHEDULE_3_CHEMICALS", r"\b(?:phosgene|hydrogen\s+cyanide|cyanogen\s+chloride|chloropicrin|phosphorus\s+(?:oxychloride|trichloride|pentachloride)|thionyl\s+chloride|triethanolamine)\b|光气|氯化氰|\b(?:75-44-5|74-90-8|506-77-4|76-06-2|10025-87-3|7719-12-2|10026-13-8|7719-09-7|102-71-6)\b"),
)
_COMPILED_CWC = tuple((name, re.compile(pattern, re.IGNORECASE)) for name, pattern in _CWC_RULES)
_OTHER_HAZARDS = re.compile(r"\b(?:RDX|HMX)\b", re.IGNORECASE)
_INJECTION = re.compile(
    r"ignore\s+(?:(?:all|previous|prior|safety)\s+)+(?:instructions|constraints|rules)"
    r"|system\s+instruction\s*:"
    r"|as\s+an?\s+unfiltered\s+ai"
    r"|\bexfiltrate\b|\b(?:api[_ -]?key|secret[_ -]?key)\b"
    r"|\bbearer\s+\S+|<\|(?:system|im_start)\|>",
    re.IGNORECASE,
)


def check_safety(content: Any) -> SafetyCheckResult:
    """Screen every nested string, including mapping keys and table headings.

    Alert paths use positional components so malicious dictionary keys cannot
    enter diagnostic messages. The source object is never modified in place.
    """
    alerts: list[SafetyAlert] = []

    def clean(value: Any, path: str) -> Any:
        if isinstance(value, str):
            hits = [name for name, pattern in _COMPILED_CWC if pattern.search(value)]
            for rule in hits:
                alerts.append(SafetyAlert(type="CRITICAL_CWC_VIOLATION", severity="critical", rule=rule, path=path))
            if _OTHER_HAZARDS.search(value):
                hits.append("ENERGETIC_MATERIAL")
                alerts.append(SafetyAlert(type="HAZARDOUS_MATERIAL", severity="critical", rule="ENERGETIC_MATERIAL", path=path))
            injection = _INJECTION.search(value) is not None
            if injection:
                alerts.append(SafetyAlert(type="INDIRECT_PROMPT_INJECTION", severity="critical", rule="INSTRUCTION_OVERRIDE_OR_SECRET_ACCESS", path=path))
            if injection:
                return "[QUARANTINED_UNTRUSTED_CONTENT]"
            if hits:
                return "[QUARANTINED_CWC_CONTENT]"
            return value
        if isinstance(value, Mapping):
            result: dict[str, Any] = {}
            for index, (key, item) in enumerate(value.items()):
                if not isinstance(key, str):
                    raise TypeError("scientific document keys must be strings")
                cleaned_key = clean(key, f"{path}.key[{index}]")
                if cleaned_key != key:
                    cleaned_key = f"quarantined_field_{index}"
                result[cleaned_key] = clean(item, f"{path}.value[{index}]")
            return result
        if isinstance(value, (list, tuple)):
            return [clean(item, f"{path}[{index}]") for index, item in enumerate(value)]
        if value is None or isinstance(value, (bool, int, float)):
            return value
        raise TypeError("safety screening accepts JSON-compatible data only")

    sanitized = clean(content, "$")
    return SafetyCheckResult(safe=not alerts, alerts=alerts, sanitized_content=sanitized)


class SafetyGuardrail:
    """Stateless entry point for callers preferring a service object."""

    def check(self, content: Any) -> SafetyCheckResult:
        return check_safety(content)
