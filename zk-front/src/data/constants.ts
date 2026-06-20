export const MALLS = [
  "쿠팡",
  "11번가",
  "G마켓",
  "옥션",
  "SSG닷컴",
  "롯데온",
  "위메프",
  "티몬",
  "인터파크",
  "네이버쇼핑",
  "카카오쇼핑",
  "다나와",
  "에누리",
  "GS샵",
  "CJ온스타일",
  "직접 입력",
] as const;

export type Mall = (typeof MALLS)[number];
