// 글로벌 출시 기준(결정 015). 게임 문구는 쓰는 자리에서 L("한국어", "English")로 나란히 적고,
// 콘텐츠 데이터는 { ko, en } 으로 둔다. 언어를 늘릴 때는 LANGS에 추가하고 콘텐츠에 칸을 더한다
// (없는 언어는 영어로 대신 보여 준다).
export const LANGS = ['ko', 'en'] as const;
export type Lang = (typeof LANGS)[number];

function pick(): Lang {
  const isLang = (v: string | null): v is Lang => !!v && (LANGS as readonly string[]).includes(v);
  const url = new URLSearchParams(location.search).get('lang'); // 확인·촬영용
  if (isLang(url)) return url;
  try {
    const saved = localStorage.getItem('lang');
    if (isLang(saved)) return saved;
  } catch {
    /* 저장소를 못 쓰는 환경 */
  }
  return navigator.language.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

export const lang: Lang = pick();
document.documentElement.lang = lang;

export const L = (ko: string, en: string) => (lang === 'ko' ? ko : en);
/** 콘텐츠 문구. 한국어·영어는 필수(content:check), 그 밖의 언어는 선택 */
export type Text = { ko: string; en: string } & Partial<Record<Lang, string>>;
export const T = (t: Text) => t[lang] ?? t.en;

export function setLang(next: Lang) {
  try {
    localStorage.setItem('lang', next);
  } catch {
    /* 저장 실패 시 이번 실행에서만 바뀜 */
  }
  location.reload();
}
