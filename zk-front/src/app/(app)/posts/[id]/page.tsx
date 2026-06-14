import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/config/navigation";
import { getPost, getAdjacent } from "@/data/posts";

type Params = { id: string };

/* ------------------------------------------------------------------ *
 * 상세 페이지
 * 목록과 동일한 단일 소스(@/data/posts)에서 id 로 글을 조회한다.
 *  - boardSlug 로 어떤 게시판인지 구분
 *  - deal(=extra_data) 이 있으면 핫딜 게시판 → 딜 정보 박스 노출
 * 실제로는 getPost 를 GET /posts/:id 호출로 교체하면 된다.
 * ------------------------------------------------------------------ */

export default async function PostDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  const post = getPost(Number(id));
  if (!post) notFound();

  const board = CATEGORIES.find((c) => c.slug === post.boardSlug);
  const { prevId, nextId } = getAdjacent(post.id);
  const totalComments =
    post.commentCount ||
    post.comments.length +
      post.comments.reduce((acc, c) => acc + c.replies.length, 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 브레드크럼 */}
      <nav className="text-xs text-slate-500 flex items-center gap-1.5">
        <Link href="/" className="hover:text-pink-600">홈</Link>
        <span>/</span>
        {board && (
          <>
            <Link href={`/category/${board.slug}`} className="hover:text-pink-600">
              {board.title}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-slate-700 font-medium truncate max-w-[160px]">{post.title}</span>
      </nav>

      {/* 본문 카드 */}
      <article className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {/* 제목 영역 */}
        <header className="px-6 pt-6 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-3">
            {board && (
              <Link
                href={`/category/${board.slug}`}
                className={`text-[11px] font-bold ${board.color} ${board.text} px-2 py-0.5 rounded-full`}
              >
                {board.icon} {board.title}
              </Link>
            )}
            {post.isHot && (
              <span className="bg-red-100 text-red-600 text-[10px] font-black px-2 py-0.5 rounded-full">
                HOT
              </span>
            )}
          </div>

          <h1 className="text-xl md:text-2xl font-black text-slate-900 leading-snug">
            {post.title}
          </h1>

          {/* 작성자 / 메타 */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center gap-2.5">
              <div className="relative w-9 h-9 rounded-full overflow-hidden bg-slate-100 border border-slate-200">
                <Image src={post.author.profileImage} alt="" fill sizes="36px" className="object-cover" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-800">{post.author.nickname}</span>
                  <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {post.author.level}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">{post.createdAt}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-400">
              <span>조회 {post.views.toLocaleString()}</span>
              <span>·</span>
              <span>댓글 {totalComments}</span>
            </div>
          </div>
        </header>

        {/* 딜 정보 박스 (핫딜 게시판 = extra_data 존재 시에만) */}
        {post.deal && (
          <div className="mx-6 mt-5 rounded-2xl border border-pink-100 bg-pink-50/50 p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
                    {post.deal.mall}
                  </span>
                  {post.deal.freeShipping && (
                    <span className="text-[11px] font-bold text-emerald-600">무료배송</span>
                  )}
                  {post.deal.isEnded ? (
                    <span className="text-[11px] font-bold text-slate-500">종료된 딜</span>
                  ) : (
                    <span className="text-[11px] font-bold text-pink-600">진행중 · ~{post.deal.endsAt}</span>
                  )}
                </div>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-pink-600">
                    {post.deal.price.toLocaleString()}원
                  </span>
                  <span className="text-sm text-slate-400 line-through mb-1">
                    {post.deal.originalPrice.toLocaleString()}원
                  </span>
                  <span className="text-sm font-black text-red-500 mb-1">
                    {post.deal.discountRate}%↓
                  </span>
                </div>
              </div>

              <a
                href={post.deal.dealUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`shrink-0 text-sm font-bold px-5 py-3 rounded-xl transition-colors flex items-center gap-1.5 ${
                  post.deal.isEnded
                    ? "bg-slate-200 text-slate-500 pointer-events-none"
                    : "bg-pink-600 hover:bg-pink-500 text-white"
                }`}
              >
                최저가 보러가기
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        )}

        {/* 본문 */}
        <div className="px-6 py-6 space-y-4">
          {post.images.length > 0 && (
            <div className="space-y-3">
              {post.images.map((src, i) => (
                <div key={i} className="relative w-full aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="(min-width:768px) 768px, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {post.content.map((para, i) => (
            <p key={i} className="text-[15px] leading-relaxed text-slate-700">
              {para}
            </p>
          ))}

          {/* 태그 */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {post.tags.map((t) => (
                <span key={t} className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 좋아요 / 공유 액션 바 */}
        <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-center gap-3">
          <button className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-600 font-bold px-6 py-2.5 rounded-xl transition-colors">
            <span>❤️</span>
            <span className="text-sm">좋아요 {post.likeCount}</span>
          </button>
          <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span>공유</span>
          </button>
          <button className="flex items-center gap-2 bg-slate-50 hover:bg-slate-100 text-slate-400 font-bold px-5 py-2.5 rounded-xl transition-colors text-sm">
            신고
          </button>
        </div>
      </article>

      {/* 댓글 섹션 */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-base font-extrabold text-slate-900 mb-4">
          댓글 <span className="text-pink-600">{totalComments}</span>
        </h2>

        {/* 댓글 입력 */}
        <div className="mb-6">
          <textarea
            placeholder="댓글을 입력하세요"
            rows={3}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-pink-400 focus:bg-white transition-colors"
          />
          <div className="flex justify-end mt-2">
            <button className="bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold px-5 py-2 rounded-lg transition-colors">
              등록
            </button>
          </div>
        </div>

        {/* 댓글 리스트 */}
        {post.comments.length > 0 ? (
          <ul className="space-y-5">
            {post.comments.map((c) => (
              <li key={c.id}>
                <div className="flex gap-3">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    <Image src={c.profileImage} alt="" fill sizes="32px" className="object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-800">{c.author}</span>
                      <span className="text-[11px] text-slate-400">
                        {c.daysAgo === 0 ? "오늘" : `${c.daysAgo}일 전`}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 mt-1 leading-relaxed">{c.content}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                      <button className="hover:text-pink-600 font-medium">❤️ {c.likeCount}</button>
                      <button className="hover:text-pink-600 font-medium">답글</button>
                    </div>

                    {/* 대댓글 */}
                    {c.replies.length > 0 && (
                      <ul className="mt-4 space-y-4 pl-4 border-l-2 border-slate-100">
                        {c.replies.map((r) => (
                          <li key={r.id} className="flex gap-3">
                            <div className="relative w-7 h-7 rounded-full overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                              <Image src={r.profileImage} alt="" fill sizes="28px" className="object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-800">{r.author}</span>
                                <span className="text-[11px] text-slate-400">
                                  {r.daysAgo === 0 ? "오늘" : `${r.daysAgo}일 전`}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mt-1 leading-relaxed">{r.content}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400">
                                <button className="hover:text-pink-600 font-medium">❤️ {r.likeCount}</button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-400 text-center py-6">
            아직 댓글이 없어요. 첫 댓글을 남겨보세요!
          </p>
        )}
      </section>

      {/* 하단 네비게이션 */}
      <div className="flex items-center justify-between">
        <Link
          href={board ? `/category/${board.slug}` : "/"}
          className="text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:border-slate-300 px-5 py-2.5 rounded-xl transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          목록
        </Link>

        <div className="flex items-center gap-2">
          {prevId !== null ? (
            <Link
              href={`/posts/${prevId}`}
              className="text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
            >
              ‹ 이전글
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-300 bg-white border border-slate-100 px-4 py-2.5 rounded-xl cursor-not-allowed">
              ‹ 이전글
            </span>
          )}
          {nextId !== null ? (
            <Link
              href={`/posts/${nextId}`}
              className="text-sm font-medium text-slate-500 bg-white border border-slate-200 hover:border-slate-300 px-4 py-2.5 rounded-xl transition-colors"
            >
              다음글 ›
            </Link>
          ) : (
            <span className="text-sm font-medium text-slate-300 bg-white border border-slate-100 px-4 py-2.5 rounded-xl cursor-not-allowed">
              다음글 ›
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
