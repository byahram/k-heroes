#!/bin/bash
set -e

# 프로젝트 루트의 .env 파일 존재 여부 확인
if [ ! -f ../.env ]; then
    echo "[ERROR] 프로젝트 루트에 .env 파일이 존재하지 않습니다. 프로젝트 루트에 .env 파일을 생성해 주세요."
    exit 1
fi

# .env 파일에서 GCP_PROJECT_ID 읽어오기 (기본값 k-heroes-499407)
PROJECT_ID=$(grep -E '^GCP_PROJECT_ID=' ../.env | cut -d '=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
if [ -z "$PROJECT_ID" ]; then
    PROJECT_ID="k-heroes-499407"
fi

# GCP 설정 정보
SERVICE_NAME="k-heroes-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "프로젝트 ID: $PROJECT_ID"
echo "서비스 이름: $SERVICE_NAME"
echo "리전: $REGION"
echo "데이터베이스: Supabase (PostgreSQL)"
echo "=========================================="

# 프로젝트 루트의 .env 파일에서 환경변수를 파싱하여 임시 YAML 파일 생성
# 주석(#) 및 인라인 주석 제거 후 포맷팅
ENV_YAML=$(mktemp)
grep -v '^#' ../.env | grep -v '^$' | sed 's/[[:space:]]*#.*$//' | while read -r line; do
  [ -z "$line" ] && continue
  key=$(echo "$line" | cut -d '=' -f1 | xargs)
  value=$(echo "$line" | cut -d '=' -f2- | xargs)
  if [ "$key" = "ADMIN_COOKIE_SECURE" ] || [ "$key" = "USER_COOKIE_SECURE" ] || [ "$key" = "COOKIE_SAMESITE" ]; then
    continue
  fi
  echo "$key: \"$value\"" >> "$ENV_YAML"
done
# GCP_PROJECT_ID 명시적 추가 (기존에 없는 경우에만)
grep -q "^GCP_PROJECT_ID:" "$ENV_YAML" || echo "GCP_PROJECT_ID: \"$PROJECT_ID\"" >> "$ENV_YAML"

# 실서버 HTTPS 크로스 도메인 환경을 위한 쿠키 설정 명시적 추가 (SameSite=None, Secure=True)
echo "ADMIN_COOKIE_SECURE: \"true\"" >> "$ENV_YAML"
echo "USER_COOKIE_SECURE: \"true\"" >> "$ENV_YAML"
echo "COOKIE_SAMESITE: \"none\"" >> "$ENV_YAML"


# Cloud Run 배포 실행 (수파베이스 연동용으로 볼륨 마운트 없이 심플하게 배포)
gcloud run deploy $SERVICE_NAME \
  --source . \
  --project $PROJECT_ID \
  --region $REGION \
  --execution-environment=gen2 \
  --allow-unauthenticated \
  --max-instances=1 \
  --env-vars-file "$ENV_YAML"

# 임시 파일 삭제
rm -f "$ENV_YAML"

echo "=========================================="
echo "[SUCCESS] 배포가 완료되었습니다!"
echo "=========================================="

