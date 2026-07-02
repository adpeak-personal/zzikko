import { cache } from "react";
import { fetchPostDetail } from "./api";

/**
 * 서버 사이드 전용 — 같은 요청 트리 안에서 fetchPostDetail 을 한 번만 실행하도록 dedupe.
 *
 * 왜 필요한가:
 *   상세 페이지는 `generateMetadata` 와 페이지 컴포넌트가 각각 `fetchPostDetail` 을 호출한다.
 *   백엔드가 view_count 를 증가시키기 때문에, 이 두 호출이 dedupe 되지 않으면 조회수가
 *   실제 방문 1회당 2씩 오르는 버그가 생긴다. React.cache 로 한 렌더 내 결과를 공유해서 방지.
 */
export const getPostDetailCached = cache(async (id: number) => {
  return fetchPostDetail(id);
});
