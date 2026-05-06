from typing import Any

from pydantic import BaseModel, Field


class CadWebhookPayload(BaseModel):
    """
    Generic CAD dispatch payload. Fields are optional to accommodate different CAD vendors.
    All string fields are lenient (str | None = None).
    """

    # Common CAD fields
    call_id: str | None = None  # CAD's internal call ID
    incident_type: str | None = None  # Free-form or NERIS code
    address: str | None = None
    cross_street: str | None = None
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    alarm_time: str | None = None  # ISO or common date string
    dispatch_time: str | None = None
    units: list[str] = Field(default_factory=list)  # Unit IDs being dispatched
    priority: str | None = None  # "1"/"2"/"3"/"4" or "high"/"medium"/"low"
    nature_of_call: str | None = None  # Free-text description
    notes: str | None = None
    # For department matching (if multi-tenant CAD)
    fdid: str | None = None
    department_name: str | None = None
    # Catch-all for vendor-specific fields
    raw: dict[str, Any] = Field(default_factory=dict)
