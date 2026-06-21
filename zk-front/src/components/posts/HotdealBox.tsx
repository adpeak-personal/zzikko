import type { HotdealExtra } from "@/service/posts/types";

export default function HotdealBox({
  deal,
  disabled,
}: {
  deal: HotdealExtra;
  /** "최저가 보러가기" 비활성화 여부 (마감됐거나 본문 링크가 정확히 1개가 아닐 때) */
  disabled: boolean;
}) {
  return (
    <div className="mx-3 mt-3 rounded-2xl border border-pink-100 bg-pink-50/50 p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded">
              {deal.mall}
            </span>
            {deal.free_shipping && (
              <span className="text-[11px] font-bold text-emerald-600">무료배송</span>
            )}
            {deal.is_ended ? (
              <span className="text-[11px] font-bold text-slate-500">마감</span>
            ) : (
              <span className="text-[11px] font-bold text-pink-600">진행중</span>
            )}
          </div>
          <div className="flex items-end gap-2">
            {typeof deal.price === "number" && (
              <span className="text-2xl font-black text-pink-600">
                {deal.price.toLocaleString()}원
              </span>
            )}
            {typeof deal.original_price === "number" && (
              <span className="text-sm text-slate-400 line-through mb-1">
                {deal.original_price.toLocaleString()}원
              </span>
            )}
            {typeof deal.discount_rate === "number" && (
              <span className="text-sm font-black text-red-500 mb-1">
                {deal.discount_rate}%↓
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0 flex flex-row items-center gap-2">
          {/* 최저가 보러가기 */}
          <a
            href={deal.deal_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={disabled}
            className={`text-sm font-bold px-3 py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5 ${
              disabled
                ? "bg-slate-200 text-slate-500 pointer-events-none"
                : "bg-pink-600 hover:bg-pink-500 text-white shadow-sm shadow-pink-600/20"
            }`}
          >
            최저가 보러가기
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>

          {/* 종료 신청 (회원 제보) — 이미 마감된 딜이면 숨김 */}
          {!deal.is_ended && (
            <button
              type="button"
              className="text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              종료 신청
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
