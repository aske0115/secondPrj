// 토스(앱인토스) 미니앱판(docs/TOSS.md). `vite build --mode toss`(테스트 광고)·`--mode toss-release`(실제 광고 그룹)에서만 참.
// 비교식으로 써야 Play·iOS 빌드에서 거짓으로 접혀 토스 SDK가 번들에 아예 들어가지 않는다
export const TOSS = import.meta.env.MODE === 'toss' || import.meta.env.MODE === 'toss-release';
export const ait = () => (TOSS ? import('@apps-in-toss/web-framework') : Promise.reject(new Error('토스판 아님')));
