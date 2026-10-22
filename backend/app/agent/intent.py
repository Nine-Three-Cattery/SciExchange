"""Validated structured intents. Free text needs a separate, untrusted-to-typed adapter."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

FiniteBound = Annotated[float, Field(strict=True, allow_inf_nan=False)]


class SearchIntent(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    domain: Literal["electrocatalysis", "battery_cycling"]
    required_columns: list[str] = Field(default_factory=list, max_length=64)
    equals: dict[str, str] = Field(default_factory=dict, max_length=20)
    numeric_ranges: dict[str, tuple[FiniteBound, FiniteBound]] = Field(default_factory=dict, max_length=20)
    allowed_licenses: list[str] = Field(default_factory=lambda: ["CC-BY-4.0"], max_length=20)

    @model_validator(mode="after")
    def ordered_ranges(self):
        if any(low > high for low, high in self.numeric_ranges.values()):
            raise ValueError("Numeric ranges must be ordered lower, upper")
        return self


def parse_intent(value: dict) -> SearchIntent:
    return SearchIntent.model_validate(value)
