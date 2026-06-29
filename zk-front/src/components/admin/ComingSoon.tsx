export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-3 py-20 text-center">
        <p className="text-4xl">🚧</p>
        <p className="text-sm font-bold text-slate-500">준비 중인 기능입니다.</p>
      </div>
    </div>
  );
}
