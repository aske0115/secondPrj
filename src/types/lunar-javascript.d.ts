// lunar-javascript(MIT)에 타입 정의가 없어 쓰는 부분만 선언한다
declare module 'lunar-javascript' {
  interface EightChar {
    getYear(): string;
    getMonth(): string;
    getDay(): string;
    getTime(): string;
    getDayGan(): string;
  }
  interface Lunar {
    getEightChar(): EightChar;
    getDayInGanZhi(): string;
  }
  interface SolarDate {
    getLunar(): Lunar;
  }
  export const Solar: {
    fromYmdHms(y: number, m: number, d: number, h: number, mi: number, s: number): SolarDate;
    fromYmd(y: number, m: number, d: number): SolarDate;
  };
  export const LunarUtil: { SHI_SHEN: Record<string, string> };
}
