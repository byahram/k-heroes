import os
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from core.security import (
    USER_SESSION_COOKIE,
    create_access_token,
    get_jwt_expire_hours,
    get_remember_me_expire_hours,
    verify_google_id_token,
    get_cookie_samesite,
)
from core.auth_policy import InvalidEmailError, InvalidLoginIdError
from db.database import get_db
from db.models import User
from models.auth.user import (
    GoogleLoginRequest,
    UserAuthResponse,
    UserLoginRequest,
    UserPlaySessionListResponse,
    UserResponse,
    UserSessionResponse,
    UserSignupRequest,
    UserUpdateRequest,
)
from repositories.auth import user as user_repository
from router.v2.deps import get_current_user

router = APIRouter(prefix="/api/v2/auth", tags=["Auth v2"])


def issue_token(user: User, *, expire_hours: int | None = None) -> str:
    try:
        return create_access_token(
            subject_id=user.id,
            role=user.grade.value,
            token_kind="user",
            expire_hours=expire_hours,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="회원 인증이 설정되지 않았습니다.") from exc


def authenticate_user(body: UserLoginRequest, db: Session) -> User:
    try:
        return user_repository.authenticate_local_user(db, body)
    except InvalidLoginIdError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.") from None


def authenticate_google_user(body: GoogleLoginRequest, db: Session) -> User:
    print("[google-auth] google/session request received", flush=True)
    try:
        payload = verify_google_id_token(body.id_token)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail="구글 인증이 설정되지 않았습니다.") from exc
    except ValueError:
        raise HTTPException(status_code=401, detail="구글 로그인 정보가 올바르지 않습니다.") from None
    except Exception:
        raise HTTPException(status_code=401, detail="구글 로그인 정보가 올바르지 않습니다.") from None

    provider_user_id = str(payload.get("sub") or "").strip()
    if not provider_user_id:
        raise HTTPException(status_code=401, detail="구글 로그인 정보가 올바르지 않습니다.")

    email = payload.get("email")
    name = payload.get("name")
    user = user_repository.authenticate_google_user(
        db,
        provider_user_id=provider_user_id,
        email=email if isinstance(email, str) and email else None,
        name=name if isinstance(name, str) and name else None,
    )
    db.commit()
    db.refresh(user)
    return user


@router.post("/signup", response_model=UserAuthResponse, status_code=201)
def signup(body: UserSignupRequest, db: Session = Depends(get_db)):
    """회원 — 로컬 가입."""
    try:
        user = user_repository.create_local_user(db, body)
        db.commit()
        db.refresh(user)
    except InvalidLoginIdError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except InvalidEmailError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except user_repository.UserDuplicateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    access_token = issue_token(user)
    return UserAuthResponse(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/login", response_model=UserAuthResponse)
def login(body: UserLoginRequest, db: Session = Depends(get_db)):
    """회원 — 로그인."""
    user = authenticate_user(body, db)
    access_token = issue_token(user)
    return UserAuthResponse(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/google", response_model=UserAuthResponse)
def google_login(body: GoogleLoginRequest, db: Session = Depends(get_db)):
    """회원 — 구글 로그인."""
    user = authenticate_google_user(body, db)
    access_token = issue_token(user)
    return UserAuthResponse(access_token=access_token, user=UserResponse.model_validate(user))


@router.post("/session", response_model=UserSessionResponse)
def create_session(
    body: UserLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """회원 — 브라우저 세션 로그인."""
    user = authenticate_user(body, db)
    expire_hours = get_remember_me_expire_hours() if body.remember_me else get_jwt_expire_hours()
    access_token = issue_token(user, expire_hours=expire_hours)
    response.set_cookie(
        key=USER_SESSION_COOKIE,
        value=access_token,
        httponly=True,
        max_age=expire_hours * 60 * 60 if body.remember_me else None,
        path="/",
        samesite=get_cookie_samesite(),
        secure=os.environ.get("USER_COOKIE_SECURE", "false").lower() == "true",
    )
    return UserSessionResponse(user=UserResponse.model_validate(user))


@router.post("/google/session", response_model=UserSessionResponse)
def create_google_session(
    body: GoogleLoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """회원 — 구글 브라우저 세션 로그인."""
    user = authenticate_google_user(body, db)
    access_token = issue_token(user)
    response.set_cookie(
        key=USER_SESSION_COOKIE,
        value=access_token,
        httponly=True,
        max_age=get_jwt_expire_hours() * 60 * 60,
        path="/",
        samesite=get_cookie_samesite(),
        secure=os.environ.get("USER_COOKIE_SECURE", "false").lower() == "true",
    )
    return UserSessionResponse(user=UserResponse.model_validate(user))


@router.post("/session/logout", status_code=204)
def delete_session(response: Response):
    """회원 — 브라우저 세션 로그아웃."""
    response.delete_cookie(
        key=USER_SESSION_COOKIE,
        path="/",
        httponly=True,
        samesite=get_cookie_samesite(),
        secure=os.environ.get("USER_COOKIE_SECURE", "false").lower() == "true",
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """회원 — 현재 로그인 정보."""
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """회원 — 계정 정보 수정."""
    try:
        updated_user = user_repository.update_current_user(db, current_user, body)
        db.commit()
        db.refresh(updated_user)
    except user_repository.UserDuplicateError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except InvalidEmailError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        message = str(exc)
        if message == "invalid current password":
            raise HTTPException(status_code=401, detail="현재 비밀번호가 올바르지 않습니다.") from exc
        if message == "password change not allowed":
            raise HTTPException(status_code=400, detail="Google 계정은 비밀번호를 변경할 수 없습니다.") from exc
        if message == "password change requires current and new password":
            raise HTTPException(status_code=400, detail="비밀번호 변경에는 현재 비밀번호와 새 비밀번호가 필요합니다.") from exc
        if message == "google email change not allowed":
            raise HTTPException(status_code=400, detail="Google 계정 이메일은 변경할 수 없습니다.") from exc
        raise
    return UserResponse.model_validate(updated_user)


@router.get("/sessions", response_model=UserPlaySessionListResponse)
def list_my_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    date_from: date | None = Query(None, description="완료일 시작일(YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="완료일 종료일(YYYY-MM-DD)"),
    character_name: str | None = Query(None, description="캐릭터 이름 부분 일치"),
    scenario_title: str | None = Query(None, description="시나리오 제목 부분 일치"),
    page: int = Query(1, ge=1, description="페이지 번호"),
    page_size: int = Query(20, ge=1, le=100, description="페이지당 항목 수"),
):
    """회원 — 완료한 시뮬레이션 기록."""
    items, total, average_history_score = user_repository.list_completed_play_sessions(
        db,
        current_user.id,
        page=page,
        page_size=page_size,
        date_from=date_from,
        date_to=date_to,
        character_name=character_name,
        scenario_title=scenario_title,
    )
    return UserPlaySessionListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        total_pages=(total + page_size - 1) // page_size,
        summary={
            "completed_count": total,
            "average_history_score": average_history_score,
        },
    )
