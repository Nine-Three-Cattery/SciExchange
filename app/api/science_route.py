"""Reject nonstandard/unserializable JSON before FastAPI's validation error renderer."""
import json

from fastapi import HTTPException, Request
from fastapi.routing import APIRoute

MAX_JSON_BYTES = 4*1024*1024


def _reject_constant(value):
    raise ValueError("Nonfinite JSON constant")


class ScienceJSONRoute(APIRoute):
    def get_route_handler(self):
        original_handler = super().get_route_handler()

        async def handler(request: Request):
            media_type = request.headers.get("content-type", "application/json").split(";")[0].strip().lower()
            if media_type != "application/json" and not (media_type.startswith("application/") and media_type.endswith("+json")):
                raise HTTPException(415, "Scientific endpoints require JSON")
            raw = await request.body()
            # A's HTTP server must also bound transport buffering/concurrency.
            if len(raw) > MAX_JSON_BYTES:
                raise HTTPException(413, "Scientific JSON payload exceeds 4 MiB")
            try:
                parsed = json.loads(raw.decode("utf-8"), parse_constant=_reject_constant)
                json.dumps(parsed, ensure_ascii=False, allow_nan=False).encode("utf-8")
            except (ValueError, RecursionError) as error:
                raise HTTPException(400, "Request must be finite UTF-8 JSON") from error
            return await original_handler(request)

        return handler
