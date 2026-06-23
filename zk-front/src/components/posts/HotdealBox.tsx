import type { HotdealExtra } from "@/service/posts/types";

export default function HotdealBox({ deal }: { deal: HotdealExtra }) {
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

        {/* 종료 신청 (회원 제보) — 이미 마감된 딜이면 숨김 */}
        {!deal.is_ended && (
          <div className="shrink-0">
            <button
              type="button"
              className="text-xs font-bold text-slate-500 bg-white border border-slate-200 hover:border-rose-300 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              종료 신청
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
