export default function PostActions({ likeCount }: { likeCount: number }) {
  return (
    <div className="px-6 py-5 border-t border-slate-100 flex items-center justify-center gap-3">
      <button className="flex items-center gap-2 bg-pink-50 hover:bg-pink-100 text-pink-600 font-bold px-6 py-2.5 rounded-xl transition-colors">
        <span>❤️</span>
        <span className="text-sm">좋아요 {likeCount}</span>
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
  );
}
