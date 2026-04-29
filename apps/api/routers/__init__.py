from fastapi import APIRouter

from routers import assets, auth, health, imports, incidents, sync, voice

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(assets.router)
api_router.include_router(imports.router)
api_router.include_router(incidents.router)
api_router.include_router(sync.router)
api_router.include_router(voice.router)
