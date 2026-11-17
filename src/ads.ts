// 보상형 광고(결정 073). 플레이어가 직접 누를 때만, 판 밖(결과·이어하기 창·상점)에서만 보여 준다(결정 051).
// 준비 순서(Google 권장): SDK 초기화 → 개인정보 동의(필요한 지역만 창) → iOS 추적 허용 요청 → 미리 불러 두기.
// 광고 SDK가 실패해도 게임은 광고 없이 그대로 간다.
import { AdMob, AdmobConsentStatus, RewardAdPluginEvents } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';
import { dayNumber } from './game/rules';

const native = Capacitor.isNativePlatform();
const ios = Capacitor.getPlatform() === 'ios';
// Google 공식 테스트 단위. 개발 중 실제 광고를 보면 계정이 정지될 수 있어 출시 빌드에서만 실제 단위를 쓴다
// https://developers.google.com/admob/ios/test-ads · https://developers.google.com/admob/android/test-ads
const real = ios ? import.meta.env.VITE_ADMOB_REWARDED_IOS : import.meta.env.VITE_ADMOB_REWARDED_ANDROID;
const unit = real && import.meta.env.MODE === 'release'
  ? { adId: real as string, isTesting: false }
  : { adId: ios ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917', isTesting: true };
const fake = !native && import.meta.env.DEV; // 브라우저 개발 서버: 1초짜리 가짜 광고로 흐름만 시험

let ready = fake, loading = false, canRequest = false, loadedAt = 0, privacyReq = false;
const MAX_AGE = 50 * 60_000; // 불러온 광고는 1시간 뒤 만료되므로 여유 두고 50분에 새로 불러온다
let onReady = () => {};
/** 광고가 준비되는 순간 부를 함수(늦게 준비된 광고를 열린 화면에 반영) */
export const onAdReady = (f: () => void) => { onReady = f; };

function preload() {
  if (!native || !canRequest || ready || loading) return;
  loading = true;
  AdMob.prepareRewardVideoAd(unit)
    .then(() => { ready = true; loadedAt = Date.now(); onReady(); })
    .catch(() => setTimeout(preload, 30_000)) // 네트워크·광고 재고 부족: 잠시 뒤 다시
    .finally(() => { loading = false; });
}

let started = false;
/** 광고 준비 시작(결정 074): 새로 깐 사람에게 게임을 보기도 전에 추적 허용 창을 띄우지 않도록 첫 판이 끝난 뒤에 부른다 */
export function initAds() {
  if (!native || started) return;
  started = true;
  void (async () => {
    try {
      await AdMob.initialize({ initializeForTesting: unit.isTesting });
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) consent = await AdMob.showConsentForm();
      canRequest = consent.canRequestAds;
      privacyReq = String(consent.privacyOptionsRequirementStatus) === 'REQUIRED'; // 동의 지역(유럽 등)은 설정에 다시 고르는 입구가 있어야 한다
      if (ios && (await AdMob.trackingAuthorizationStatus()).status === 'notDetermined') await AdMob.requestTrackingAuthorization();
      preload();
    } catch {
      /* 광고 없이 진행 */
    }
  })();
}

export function adReady() {
  if (ready && !fake && Date.now() - loadedAt > MAX_AGE) { ready = false; preload(); }
  return ready;
}

export const privacyRequired = () => privacyReq;
/** 설정의 「개인정보 설정」: 동의를 다시 고른 뒤 광고를 불러올 수 있는지 다시 읽는다 */
export async function openPrivacy() {
  if (!native) return;
  try {
    await AdMob.showPrivacyOptionsForm();
    canRequest = (await AdMob.requestConsentInfo()).canRequestAds;
    if (!canRequest) ready = false; // 동의를 거두면 미리 불러 둔 광고도 쓰지 않는다
    preload();
  } catch { /* 창을 못 띄우면 그대로 */ }
}

/** 개발 훅(__demo.ads): 다음 가짜 광고 실패시키기·중간에 닫기, 준비 상태·개인정보 입구 바꾸기 */
export const adDev = {
  failNext: false,
  closeNext: false,
  setReady(v: boolean) { ready = v; if (v) onReady(); },
  setPrivacy(v: boolean) { privacyReq = v; },
};

export type AdResult = 'earned' | 'closed' | 'failed';
/** earned = 끝까지 봄, closed = 보다가 닫음, failed = 보여 주지 못함.
 *  플러그인의 show는 중간에 닫으면 끝나지 않아 닫힘·실패 이벤트로 끝을 판단한다 */
export async function showAd(): Promise<AdResult> {
  if (!adReady()) return 'failed';
  ready = fake;
  if (fake) {
    const res: AdResult = adDev.failNext ? 'failed' : adDev.closeNext ? 'closed' : 'earned';
    adDev.failNext = adDev.closeNext = false;
    if (res !== 'earned') ready = false; // 실기기처럼 본 뒤엔 다음 광고가 아직 준비 안 된 상황을 흉내 낸다
    return new Promise((r) => setTimeout(() => r(res), 1000));
  }
  let earned = false, failed = false, finish!: () => void;
  const closed = new Promise<void>((r) => (finish = r));
  const handles = await Promise.all([
    AdMob.addListener(RewardAdPluginEvents.Rewarded, () => (earned = true)),
    AdMob.addListener(RewardAdPluginEvents.Dismissed, () => finish()),
    AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => { failed = true; finish(); }),
  ]);
  AdMob.showRewardVideoAd().catch(() => { failed = true; finish(); });
  await closed;
  for (const h of handles) void h.remove();
  preload(); // 본 광고는 다시 못 쓰므로 다음 것을 미리
  return earned ? 'earned' : failed ? 'failed' : 'closed';
}

// 하루 상한(결정 073): 코인 2배 3번, 무료 캡슐 1번. 날짜가 바뀌면 다시 센다
type Daily = { day: number; doubles: number; capsule: number };
const DAY = () => dayNumber(Date.now());
export const DOUBLES_PER_DAY = 3;
export function adDaily(): Daily {
  try {
    const d = JSON.parse(localStorage.getItem('ads') ?? '{}') as Partial<Daily>;
    if (d.day === DAY()) return { day: d.day, doubles: d.doubles ?? 0, capsule: d.capsule ?? 0 };
  } catch { /* 처음부터 */ }
  return { day: DAY(), doubles: 0, capsule: 0 };
}
export function useAdDaily(key: 'doubles' | 'capsule') {
  const d = adDaily();
  d[key]++;
  try { localStorage.setItem('ads', JSON.stringify(d)); } catch { /* 이번 실행에서만 */ }
}
