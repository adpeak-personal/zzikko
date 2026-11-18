import type { Carrier, JoinType, SiseRow } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * 시세표.
 *
 * **이 표는 코드가 그린다.** AI 가 쓴 건 해설 문장뿐이다 —
 * 가격까지 맡기면 환각으로 숫자가 틀어지고, 시세 글에서 그건 사고다.
 */

const CARRIERS: Carrier[] = ['SKT', 'KT', 'LG U+'];
const JOINS: JoinType[] = ['번호이동', '기기변경'];

const CARRIER_STYLE: Record<string, string> = {
  SKT: 'text-red-600',
  KT: 'text-slate-900',
  'LG U+': 'text-pink-600',
  알뜰폰: 'text-emerald-700',
};

/** 음수는 페이백이다. 손님이 돈을 받는 쪽이라 눈에 띄게 둔다. */
function Price({ value }: { value: number }) {
  if (value < 0) {
    return <span className="font-bold text-zz-600">-{Math.abs(value)}</span>;
  }
  return <span className="font-semibold text-gray-900">{value}</span>;
}

export function SiseTable({ rows }: { rows: SiseRow[] }) {
  // 시리즈 → 기종 순서를 표에 나온 그대로 지킨다
  const series: { name: string; models: { model: string; storage: string; cells: Map<string, number> }[] }[] = [];

  for (const row of rows) {
    let group = series.find((item) => item.name === row.series);
    if (!group) {
      group = { name: row.series || '기타', models: [] };
      series.push(group);
    }
    let model = group.models.find((item) => item.model === row.model && item.storage === row.storage);
    if (!model) {
      model = { model: row.model, storage: row.storage, cells: new Map() };
      group.models.push(model);
    }
    model.cells.set(`${row.carrier}|${row.joinType}`, row.price);
  }

  // 요금제 이름은 통신사마다 하나로 본다 (표 머리에 적힌 그대로)
  const planOf = (carrier: Carrier) => rows.find((row) => row.carrier === carrier)?.plan ?? '';

  return (
    <div className="space-y-6">
      {series.map((group) => (
        <section key={group.name}>
          <h3 className="mb-2 text-base font-bold text-gray-900">{group.name}</h3>

          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th rowSpan={2} className="px-3 py-2 text-left text-[11px] font-semibold text-gray-500">
                    기종
                  </th>
                  <th rowSpan={2} className="px-2 py-2 text-[11px] font-semibold text-gray-500">
                    용량
                  </th>
                  {CARRIERS.map((carrier) => (
                    <th
                      key={carrier}
                      colSpan={2}
                      className={cn('border-l border-gray-200 px-2 pt-2 text-xs font-bold', CARRIER_STYLE[carrier])}
                    >
                      {carrier}
                      {planOf(carrier) && (
                        <span className="block text-[10px] font-normal text-gray-400">{planOf(carrier)}</span>
                      )}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-gray-200 bg-gray-50 text-[11px] text-gray-500">
                  {CARRIERS.map((carrier) =>
                    JOINS.map((join, index) => (
                      <th
                        key={`${carrier}-${join}`}
                        className={cn('px-2 pb-2 font-medium', index === 0 && 'border-l border-gray-200')}
                      >
                        {join === '번호이동' ? '번이' : '기변'}
                      </th>
                    )),
                  )}
                </tr>
              </thead>
              <tbody>
                {group.models.map((model) => (
                  <tr key={`${model.model}-${model.storage}`} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-2.5 font-semibold text-gray-900">{model.model}</td>
                    <td className="px-2 py-2.5 text-center text-xs text-gray-500">{model.storage}</td>
                    {CARRIERS.map((carrier) =>
                      JOINS.map((join, index) => {
                        const value = model.cells.get(`${carrier}|${join}`);
                        return (
                          <td
                            key={`${carrier}-${join}`}
                            className={cn('px-2 py-2.5 text-center', index === 0 && 'border-l border-gray-100')}
                          >
                            {value === undefined ? <span className="text-gray-300">–</span> : <Price value={value} />}
                          </td>
                        );
                      }),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-gray-400">
        숫자는 <b>만원</b> 단위입니다. <span className="font-semibold text-zz-600">-75</span> 처럼 음수로 적힌 값은
        할부원금이 아니라 <b>75만원을 돌려받는다</b>는 뜻입니다.
      </p>
    </div>
  );
}
