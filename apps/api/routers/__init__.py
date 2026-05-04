from fastapi import APIRouter

from routers import assets, auth, equipment, health, imports, incidents, roster, sync, voice, voice_logs

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(assets.router)
api_router.include_router(equipment.router)
api_router.include_router(imports.router)
api_router.include_router(incidents.router)
api_router.include_router(roster.router)
api_router.include_router(sync.router)
api_router.include_router(voice.router)
api_router.include_router(voice_logs.router)
