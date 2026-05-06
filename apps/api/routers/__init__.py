from fastapi import APIRouter

from routers import (
    analytics,
    assets,
    attachments,
    auth,
    cad,
    equipment,
    health,
    imports,
    incidents,
    mutual_aid,
    notifications,
    roster,
    scheduling,
    sync,
    training,
    voice,
    voice_logs,
)

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(analytics.router)
api_router.include_router(assets.router)
api_router.include_router(equipment.router)
api_router.include_router(imports.router)
api_router.include_router(cad.router)
api_router.include_router(incidents.router)
api_router.include_router(mutual_aid.agencies_router)
api_router.include_router(mutual_aid.incidents_mutual_aid_router)
api_router.include_router(attachments.router)
api_router.include_router(notifications.router)
api_router.include_router(roster.router)
api_router.include_router(scheduling.router)
api_router.include_router(sync.router)
api_router.include_router(training.router)
api_router.include_router(voice.router)
api_router.include_router(voice_logs.router)
