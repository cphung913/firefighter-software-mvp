from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.db import get_db
from core.deps import get_current_user
from models.user import User
from schemas.imports import (
    ImportCommitRequest,
    ImportCommitResponse,
    ImportPreviewRequest,
    ImportPreviewResponse,
    ImportUploadResponse,
)
from services.import_service import (
    ImportNotFoundError,
    ImportServiceError,
    commit_preview,
    get_preview,
    stage_upload,
)

router = APIRouter(prefix="/import", tags=["import"])


@router.post("/upload", response_model=ImportUploadResponse)
async def upload_import_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportUploadResponse:
    try:
        content = await file.read()
        if not content:
            raise ImportServiceError("The uploaded file was empty.")
        return await stage_upload(
            db,
            department_id=user.department_id,
            file_name=file.filename or "upload.csv",
            content=content,
        )
    except ImportServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/preview", response_model=ImportPreviewResponse)
async def preview_import(
    payload: ImportPreviewRequest,
    user: User = Depends(get_current_user),
) -> ImportPreviewResponse:
    try:
        return get_preview(payload.upload_id, user.department_id)
    except ImportNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/commit", response_model=ImportCommitResponse)
async def commit_import(
    payload: ImportCommitRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ImportCommitResponse:
    try:
        return await commit_preview(
            db,
            department_id=user.department_id,
            user_id=user.id,
            upload_id=payload.upload_id,
        )
    except ImportNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ImportServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
