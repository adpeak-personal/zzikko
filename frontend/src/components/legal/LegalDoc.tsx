/**
 * 이용약관 · 개인정보처리방침 화면 틀.
 *
 * ⚠️ 문장은 운영 초안이다. 운영 주체(사업자명·연락처)가 정해지면 `OPERATOR` 를 채우고,
 * 정식 서비스 전에는 법률 검토를 받을 것. 내용을 바꾸면 `effective`(시행일)도 같이 바꾼다 —
 * 개인정보처리방침은 바뀐 날짜와 이전 판을 공개하는 게 원칙이다.
 */
export const OPERATOR = {
  name: '찍고 운영팀',
  /** 정해지면 채운다. 비어 있으면 화면에 '준비 중'으로 나온다 */
  email: '',
};

export interface LegalSection {
  title: string;
  /** 문단. 배열이면 번호 목록으로 그린다 */
  body: (string | string[])[];
}

export function LegalDoc({ title, effective, intro, sections }: {
  title: string;
  effective: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <article className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-white px-6 py-8 sm:px-10">
      <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-400">시행일 {effective}</p>
      <p className="mt-5 text-[15px] leading-relaxed text-gray-700">{intro}</p>

      <nav aria-label="목차" className="mt-6 rounded-xl bg-gray-50 px-5 py-4">
        <ol className="grid gap-1 text-sm text-gray-600 sm:grid-cols-2">
          {sections.map((section, index) => (
            <li key={section.title}>
              <a href={`#s${index + 1}`} className="hover:text-zz-700 hover:underline">
                {index + 1}. {section.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sections.map((section, index) => (
        <section key={section.title} id={`s${index + 1}`} className="mt-8 scroll-mt-24">
          <h2 className="text-base font-bold text-gray-900">
            제{index + 1}조 ({section.title})
          </h2>
          {section.body.map((block, blockIndex) =>
            Array.isArray(block) ? (
              <ol key={blockIndex} className="mt-2 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed text-gray-700">
                {block.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            ) : (
              <p key={blockIndex} className="mt-2 text-[15px] leading-relaxed text-gray-700">
                {block}
              </p>
            ),
          )}
        </section>
      ))}
    </article>
  );
}
