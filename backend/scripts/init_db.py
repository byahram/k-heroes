"""
DB 테이블 생성 스크립트 (Supabase/PostgreSQL 전용).

사용법 (backend 디렉터리에서):
    python3 scripts/init_db.py           # 테이블 없으면 생성 + 스키마 마이그레이션
    python3 scripts/init_db.py --reset   # 기존 테이블 전부 삭제 후 재생성
"""
from __future__ import annotations

import argparse
import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from alembic import command
from alembic.config import Config

from db.database import DATABASE_URL, Base, engine
import db.models  # noqa: F401


def _run_alembic_upgrade() -> None:
    alembic_cfg = Config(os.path.join(BASE_DIR, "alembic.ini"))
    alembic_cfg.set_main_option("script_location", os.path.join(BASE_DIR, "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
    command.upgrade(alembic_cfg, "head")


def init_tables(reset: bool = False) -> None:
    if reset:
        print("[INFO] 기존 테이블 삭제 중...")
        Base.metadata.drop_all(bind=engine)

    print("[INFO] 테이블 생성 중...")
    Base.metadata.create_all(bind=engine)
    
    try:
        print("[INFO] Alembic 마이그레이션 적용 중...")
        _run_alembic_upgrade()
    except Exception as e:
        print("[WARNING] Alembic 마이그레이션 생략 (또는 오류):", e)
        
    print("[SUCCESS] 테이블 생성 완료")


def main() -> None:
    parser = argparse.ArgumentParser(description="Supabase DB 테이블 생성")
    parser.add_argument("--reset", action="store_true", help="기존 테이블 삭제 후 재생성")
    args = parser.parse_args()
    init_tables(reset=args.reset)


if __name__ == "__main__":
    main()
