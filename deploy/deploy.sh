#!/usr/bin/env bash
# 서버(/opt/zzikko)에서 이미지를 받아 교체하고, 실제로 뜨는지까지 확인한다.
#   ZZIKKO_TAG=sha-<커밋> bash /opt/zzikko/deploy.sh   (롤백·특정 버전)
#   bash /opt/zzikko/deploy.sh                          (지금 떠 있는 버전 그대로 다시)
#
# ⚠️ .env.back 만 고쳤을 때도 **이 스크립트로** 돌려라.
#    env_file 은 컨테이너를 만들 때만 읽히므로 restart 로는 반영되지 않고,
#    `docker compose up -d --force-recreate back` 은 이미지를 받아오지 않는다.
set -euo pipefail
cd "$(dirname "$0")"

# 태그를 안 주면 마지막으로 성공한 배포를 그대로 다시 올린다.
# latest 로 떨어뜨리면 안 된다 — 워크플로는 늘 sha-<커밋> 으로 배포하므로 서버의 latest 는
# 맨 처음 받은 옛 이미지에 멈춰 있다. 실제로 그걸 띄웠다가 S3 이전 코드가 올라온 적이 있다.
export ZZIKKO_TAG="${ZZIKKO_TAG:-$(cat .tag 2>/dev/null || echo latest)}"
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

# 다음에 태그 없이 돌렸을 때 이 버전으로 돌아오게 적어 둔다
echo "$ZZIKKO_TAG" > .tag

echo "== 배포 완료: $ZZIKKO_TAG"
docker compose ps
