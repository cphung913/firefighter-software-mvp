import base64
import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_department, get_current_user
from models.attachment import IncidentAttachment
from models.department import Department
from models.incident import Incident
from models.user import User
from schemas.attachments import AttachmentOut

router = APIRouter(prefix="/incidents/{incident_id}/attachments", tags=["attachments"])

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024


async def _get_incident_for_department(
    db: AsyncSession,
    incident_id: uuid.UUID,
    department_id: uuid.UUID,
) -> Incident:
    incident = await db.scalar(
        select(Incident).where(
            Incident.id == incident_id,
            Incident.department_id == department_id,
        )
    )
    if incident is None:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


def _detect_file_type(mime: str) -> str:
    if mime.startswith("image/"):
        return "photo"
    if mime.startswith("video/"):
        return "video"
    if mime.startswith("audio/"):
        return "audio"
    if mime == "application/pdf":
        return "document"
    return "other"


@router.get("", response_model=list[AttachmentOut])
async def list_attachments(
    incident_id: uuid.UUID,
    _user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> list[AttachmentOut]:
    await _get_incident_for_department(db, incident_id, department.id)
    result = await db.scalars(
        select(IncidentAttachment)
        .where(
            IncidentAttachment.incident_id == incident_id,
            IncidentAttachment.department_id == department.id,
        )
        .order_by(IncidentAttachment.created_at.desc())
    )
    rows = list(result.all())
    return [AttachmentOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    incident_id: uuid.UUID,
    file: UploadFile,
    caption: str | None = Form(None),
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> AttachmentOut:
    incident = await _get_incident_for_department(db, incident_id, department.id)

    content = await file.read()
    if len(content) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit")

    mime = (file.content_type or "application/octet-stream").split(";")[0].strip()
    file_type = _detect_file_type(mime)
    b64 = base64.standard_b64encode(content).decode("ascii")
    file_ref = f"data:{mime};base64,{b64}"

    row = IncidentAttachment(
        incident_id=incident.id,
        department_id=department.id,
        file_type=file_type,
        original_filename=file.filename,
        file_ref=file_ref,
        mime_type=mime,
        file_size_bytes=len(content),
        caption=caption,
        uploaded_by=user.id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return AttachmentOut.model_validate(row, from_attributes=True)


@router.delete("/{attachment_id}", status_code=204)
async def delete_attachment(
    incident_id: uuid.UUID,
    attachment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    department: Department = Depends(get_current_department),
    db: AsyncSession = Depends(get_db),
) -> None:
    row = await db.scalar(
        select(IncidentAttachment).where(
            IncidentAttachment.id == attachment_id,
            IncidentAttachment.incident_id == incident_id,
            IncidentAttachment.department_id == department.id,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Attachment not found")

    is_admin = user.role == "admin"
    is_uploader = row.uploaded_by is not None and row.uploaded_by == user.id
    if not (is_admin or is_uploader):
        raise HTTPException(
            status_code=403,
            detail="Only the uploader or an admin may delete this attachment",
        )

    await db.delete(row)
    await db.commit()
