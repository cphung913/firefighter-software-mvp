from fastapi import APIRouter

from routers import auth, checklists, health, sync

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(checklists.router)
api_router.include_router(sync.router)
