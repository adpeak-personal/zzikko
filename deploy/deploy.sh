#!/usr/bin/env bash
# 서버(/opt/zzikko)에서 이미지를 받아 교체하고, 실제로 뜨는지까지 확인한다.
#   ZZIKKO_TAG=sha-<커밋> bash /opt/zzikko/deploy.sh   (없으면 latest)
set -euo pipefail
cd "$(dirname "$0")"

export ZZIKKO_TAG="${ZZIKKO_TAG:-latest}"
echo "== zzikko 배포: $ZZIKKO_TAG"

[ -f .env.back ] || { echo "::error::/opt/zzikko/.env.back 이 없습니다"; exit 1; }
mkdir -p uploads
chown 1000:1000 uploads   # 컨테이너의 node 사용자가 써야 한다

docker compose pull
docker compose up -d --remove-orphans
docker image prune -f > /dev/null

fail() {
  echo "::error::$1"
  docker compose ps -a
  echo "===== back 로그 ====="; docker compose logs --tail=80 back || true
  echo "===== front 로그 ====="; docker compose logs --tail=80 front || true
  exit 1
}

ok=0
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3041/api/v1/health > /dev/null 2>&1; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || fail "백엔드 헬스체크 실패"

ok=0
for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3040/ || true)
  if [ "$code" = 200 ]; then ok=1; break; fi
  sleep 2
done
[ "$ok" = 1 ] || fail "프론트 응답 실패 (마지막 코드 ${code:-없음})"

# 화면이 백엔드에서 게시판을 받아 그렸는지 본다 — 200 만 보면 빈 껍데기도 통과한다
curl -fsS http://127.0.0.1:3040/ | grep -q '/board/' || fail "메인에 게시판 링크가 없습니다 (백엔드 연결 확인)"

echo "== 배포 완료: $ZZIKKO_TAG"
docker compose ps
