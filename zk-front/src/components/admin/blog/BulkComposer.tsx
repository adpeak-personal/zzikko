"use client";

import { useEffect, useMemo, useState } from "react";
import {
  distributeTimes,
  parseBulkInput,
  splitKeywords,
  formatSchedule,
  toLocalInputValue,
  type DistMode,
} from "@/lib/blog-schedule";
import { useBlogJobsStore } from "@/store/blogJobs";

// 미리보기에서 편집 중인 행 (키워드는 콤마 텍스트로 편집)
type EditRow = { title: string; keywordsText: string };

const MODES: { value: DistMode; label: string; desc: string; icon: string }[] = [
  { value: "even", label: "균등 분배", desc: "전체 시간을 똑같은 간격으로", icon: "📏" },
  { value: "random", label: "랜덤 분배", desc: "자연스럽게 흩뿌려서", icon: "🎲" },
  { value: "daytime", label: "활동시간 집중", desc: "밤 시간 빼고 낮에만", icon: "☀️" },
];

const PLACEHOLDER = `제목 | 키워드 형식으로 한 줄에 하나씩 붙여넣으세요. 키워드는 콤마로 여러 개 입력할 수 있어요.
엑셀/시트에서 복사(탭 구분)도 됩니다.

강남 휴대폰 성지 갤럭시 S26 합리적인 구매 방법 | 강남휴대폰성지, 갤럭시S26
홍대 휴대폰 성지 아이폰 17 프로 최저가 확인 | 홍대휴대폰성지, 아이폰17프로
...`;

type Props = { onRegistered: () => void };

export default function BulkComposer({ onRegistered }: Props) {
  const addJobs = useBlogJobsStore((s) => s.addJobs);

  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState<EditRow[]>([]);
  const [startAt, setStartAt] = useState("");
  const [windowHours, setWindowHours] = useState(24);
  const [mode, setMode] = useState<DistMode>("random");
  const [dayStart, setDayStart] = useState(9);
  const [dayEnd, setDayEnd] = useState(23);

  // 시작 시각 기본값(현재) — 마운트 후 설정해 hydration 불일치 방지
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStartAt(toLocalInputValue(new Date()));
  }, []);

  function handleParse() {
    setRows(
      parseBulkInput(raw).map((r) => ({
        title: r.title,
        keywordsText: r.keywords.join(", "),
      })),
    );
  }

  const times = useMemo(() => {
    if (!startAt || rows.length === 0) return [];
    return distributeTimes(rows.length, {
      startAt: new Date(startAt),
      windowHours,
      mode,
      dayStart,
      dayEnd,
    });
  }, [rows.length, startAt, windowHours, mode, dayStart, dayEnd]);

  const missingKeyword = rows.filter((r) => splitKeywords(r.keywordsText).length === 0).length;

  function updateRow(i: number, patch: Partial<EditRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleRegister() {
    if (rows.length === 0 || times.length !== rows.length) return;
    addJobs(
      rows.map((r, i) => {
        const keywords = splitKeywords(r.keywordsText);
        return {
          title: r.title,
          keywords: keywords.length > 0 ? keywords : [r.title],
          scheduledAt: times[i].toISOString(),
        };
      }),
    );
    setRaw("");
    setRows([]);
    onRegistered();
  }

  return (
    <div className="space-y-6">
      {/* 1. 일괄 입력 */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-extrabold text-slate-900">1. 제목·키워드 붙여넣기</h2>
          <span className="text-xs text-slate-400">한 줄에 하나씩</span>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={7}
          className="w-full text-sm border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-blue-400 resize-y font-mono leading-relaxed"
        />
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={handleParse}
            className="text-sm font-bold text-white bg-slate-900 hover:bg-slate-700 px-4 py-2 rounded-xl transition-colors"
          >
            파싱하기
          </button>
          {rows.length > 0 && (
            <span className="text-sm text-slate-500">
              <b className="text-slate-900">{rows.length}</b>개 인식됨
              {missingKeyword > 0 && (
                <span className="text-amber-600"> · 키워드 비어있음 {missingKeyword}개</span>
              )}
            </span>
          )}
        </div>
      </section>

      {/* 2. 분배 설정 */}
      <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
        <h2 className="font-extrabold text-slate-900 mb-4">2. 시간 분배 설정</h2>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <label className="block">
            <span className="text-xs font-bold text-slate-500">시작 시각</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400"
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold text-slate-500">분배 시간(시간)</span>
            <input
              type="number"
              min={1}
              max={168}
              value={windowHours}
              onChange={(e) => setWindowHours(Math.max(1, Number(e.target.value)))}
              className="mt-1 w-full text-sm border border-slate-200 rounded-xl px-3 py-2 outline-none focus:border-blue-400"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => setMode(m.value)}
              className={`text-left p-3 rounded-xl border transition-all ${
                mode === m.value
                  ? "border-blue-400 bg-blue-50/60 ring-1 ring-blue-300"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="text-lg">{m.icon}</div>
              <div className="font-bold text-sm text-slate-800 mt-1">{m.label}</div>
              <div className="text-[11px] text-slate-400">{m.desc}</div>
            </button>
          ))}
        </div>

        {mode === "daytime" && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="text-xs font-bold text-slate-500">발행 허용 시간대</span>
            <input
              type="number"
              min={0}
              max={23}
              value={dayStart}
              onChange={(e) => setDayStart(Number(e.target.value))}
              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center"
            />
            <span className="text-slate-400">시 ~</span>
            <input
              type="number"
              min={1}
              max={24}
              value={dayEnd}
              onChange={(e) => setDayEnd(Number(e.target.value))}
              className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-center"
            />
            <span className="text-slate-400">시</span>
          </div>
        )}
      </section>

      {/* 3. 미리보기 */}
      {rows.length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h2 className="font-extrabold text-slate-900">3. 예약 미리보기</h2>
            <button
              onClick={handleRegister}
              className="text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl transition-colors"
            >
              {rows.length}개 예약 등록
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 font-bold w-12">#</th>
                  <th className="px-4 py-3 font-bold">발행 시각</th>
                  <th className="px-4 py-3 font-bold">제목</th>
                  <th className="px-4 py-3 font-bold">키워드</th>
                  <th className="px-4 py-3 font-bold w-12" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-2 text-slate-400 tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2 font-bold text-blue-600 whitespace-nowrap tabular-nums">
                      {times[i] ? formatSchedule(times[i].toISOString()) : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={row.title}
                        onChange={(e) => updateRow(i, { title: e.target.value })}
                        className="w-full min-w-48 border border-transparent hover:border-slate-200 focus:border-blue-400 rounded-lg px-2 py-1 outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={row.keywordsText}
                        onChange={(e) => updateRow(i, { keywordsText: e.target.value })}
                        placeholder="키워드1, 키워드2"
                        className={`w-full min-w-40 border rounded-lg px-2 py-1 outline-none focus:border-blue-400 ${
                          splitKeywords(row.keywordsText).length > 0
                            ? "border-transparent hover:border-slate-200"
                            : "border-amber-300 bg-amber-50"
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-slate-300 hover:text-red-500"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
