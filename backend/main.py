import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# from router import character, simulation
from router.v2 import auth as auth_v2, admin_auth as admin_auth_v2, admin_play_session as admin_play_session_v2, admin_user as admin_user_v2, character as character_v2, character_category as character_category_v2, ending as ending_v2, scenario as scenario_v2, simulation as simulation_v2, turn as turn_v2, landing as landing_v2
from router.v2.auth import teacher_grade_application as teacher_grade_application_v2, user_admin as user_admin_v2
from router.v2.classroom.classroom import router as classroom_router
from router.v2.classroom.classroom_admin import admin_router as classroom_admin_router
from router.v2.classroom.classroom_student import router as classroom_student_router
import simulation_data_manager

app = FastAPI()

frontend_port = os.environ.get("FRONTEND_PORT", "3000")
cors_origins = [
    origin.strip()
    for origin in os.environ.get(
        "CORS_ORIGINS",
        f"http://localhost:{frontend_port},http://127.0.0.1:{frontend_port}",
    ).split(",")
    if origin.strip()
]

# CORS 설정 추가
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록

# 인메모리 작업 (v1) - 비활성화
# app.include_router(character.router)
# app.include_router(simulation.router)

# Supabase (v2)
app.include_router(auth_v2.router)
app.include_router(teacher_grade_application_v2.router)
app.include_router(classroom_router)
app.include_router(classroom_student_router)
app.include_router(classroom_admin_router)
app.include_router(character_category_v2.router)
app.include_router(character_v2.router)
app.include_router(simulation_v2.router)
app.include_router(landing_v2.router)

app.include_router(admin_auth_v2.router)
app.include_router(admin_user_v2.admin_router)
app.include_router(user_admin_v2.admin_router)
app.include_router(admin_play_session_v2.admin_router)
app.include_router(teacher_grade_application_v2.admin_router)
app.include_router(character_category_v2.admin_router)
app.include_router(character_v2.admin_router)
app.include_router(scenario_v2.admin_router)
app.include_router(turn_v2.admin_router)
app.include_router(ending_v2.admin_router)




# 서버 가동 시점에 전역 캐시 로드 가동
@app.on_event("startup")
async def startup_event():
    from scripts.ensure_db import ensure_database

    ensure_database()
    simulation_data_manager.load_regions_to_memory()

@app.get("/")
def root():
    return {"status": "running", "message": "백엔드 정상 구동 중"}
