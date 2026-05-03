import Link from "next/link";
import CategoryHeader, { WriteButton } from "@/components/category/CategoryHeader";
import CategoryToolbar from "@/components/category/CategoryToolbar";
import Pagination from "@/components/category/Pagination";

const QUESTIONS = Array.from({ length: 12 }).map((_, i) => ({
  id: i + 1,
  title: `${["S24 자급제 vs 성지 어떤 게 나을까요?", "공시지원금 vs 선택약정", "유심기변하면 위약금 나오나요?", "할부원금이 뭔가요?", "현금완납 안전한가요?"][i % 5]}`,
  body: "구체적인 상황 설명과 궁금한 부분을 적어주시면 더 정확한 답변을 받으실 수 있어요. 지금까지 알아본 내용은 다음과 같습니다...",
  author: ["초보유저", "처음가입", "통신변경예정", "고민중", "도와주세요"][i % 5],
  answers: (i * 3) % 9,
  views: 50 + ((i * 91) % 3000),
  daysAgo: i,
  isSolved: i % 3 === 0,
  tags: [["자급제", "성지"], ["공시", "선택약정"], ["유심기변"], ["할부원금"], ["현금완납"]][i % 5],
}));

export default function QnaPage() {
  return (
    <div className="space-y-6">
      <CategoryHeader slug="qna" cta={<WriteButton label="질문하기" />} />
      <CategoryToolbar
        filters={["전체", "미해결", "해결됨", "답변 많은순", "최신순"]}
        searchPlaceholder="질문 검색"
      />

      <ul className="space-y-3">
        {QUESTIONS.map((q) => (
          <li key={q.id}>
            <Link
              href={`/category/qna/${q.id}`}
              className="block bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-blue-200 transition-all"
            >
              <div className="flex items-start gap-4">
                {/* 답변 카운트 */}
                <div
                  className={`shrink-0 w-14 h-14 rounded-xl flex flex-col items-center justify-center text-center ${
                    q.isSolved
                      ? "bg-emerald-50 text-emerald-600"
                      : q.answers > 0
                      ? "bg-blue-50 text-blue-600"
                      : "bg-slate-50 text-slate-400"
                  }`}
                >
                  <span className="text-lg font-black leading-none">{q.answers}</span>
                  <span className="text-[10px] font-bold mt-0.5">답변</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {q.isSolved ? (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded">
                        ✓ 해결됨
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-700 text-[10px] font-black px-2 py-0.5 rounded">
                        미해결
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {q.author} · {q.daysAgo === 0 ? "오늘" : `${q.daysAgo}일 전`} · 조회 {q.views.toLocaleString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 leading-snug mb-1.5">
                    Q. {q.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">
                    {q.body}
                  </p>
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    {q.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <Pagination />
    </div>
  );
}
