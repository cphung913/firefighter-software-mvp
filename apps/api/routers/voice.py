from fastapi import APIRouter, Depends

from core.deps import get_current_user
from models.user import User

router = APIRouter(prefix="/voice-sessions", tags=["voice"])


@router.get("/ping")
async def voice_ping(_user: User = Depends(get_current_user)) -> dict[str, str]:
    return {"status": "voice router ready"}
