// 에이전트 팀(브라우저 도구 없음)이 개발 훅 __demo를 부르고 화면을 찍는 도구(결정 077).
// 준비: 다른 터미널(또는 백그라운드)에서 `npm run dev` (포트 5317)
// 실행: npm exec --yes --package=playwright@1.65.0 -- node scripts/demo.mjs [옵션]
//   --eval "await __demo.bot(20, 0.85, 0, false)"   페이지에서 실행하고 결과를 JSON으로 출력(await 가능)
//   --shot out.png                                    실행 뒤 화면 저장
//   --size 375x812                                    화면 크기(기본 375x812, 태블릿 1280x800, 폴더블 가로 1000x780)
//   --meta '{"cleared":60,"coins":5000}'              진행 상태를 넣고 시작(해금된 장·코인 있는 상점 화면 확인용)
// 실행할 때마다 임시 프로필이라 늘 새 사용자로 시작한다(평소 Chrome 저장값과 별개).
// --eval은 세미콜론으로 문장을 나누므로 문자열 안에 ';'를 쓰면 안 된다.
// 예: 처음~끝 밸런스  --eval "await __demo.campaign(300)"
//     강화별 비교     --eval "__demo.setPerks({shove:10}); await __demo.bot(20, 0.85, 50, true)"
//     스테이지 화면   --eval "await __demo.goStage(45)" --shot /tmp/ch4.png
// 브라우저는 이 맥의 Google Chrome을 쓴다(Playwright 브라우저를 따로 받지 않음).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let playwright;
try {
  playwright = await import('playwright');
} catch {
  const bin = process.env.PATH.split(path.delimiter).find((d) => existsSync(path.resolve(d, '../playwright/index.mjs')));
  if (!bin) throw new Error('맨 위 주석의 npm exec 명령으로 실행해 주세요.');
  playwright = await import(pathToFileURL(path.resolve(bin, '../playwright/index.mjs')).href);
}

const arg = (name) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const [w, h] = (arg('--size') ?? '375x812').split('x').map(Number);
const url = process.env.DEMO_URL ?? 'http://localhost:5317/?lang=ko';

const browser = await playwright.chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: w, height: h }, locale: 'ko-KR' });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url);
  const metaArg = arg('--meta');
  if (metaArg) {
    await page.evaluate((m) => localStorage.setItem('meta', m), JSON.stringify(JSON.parse(metaArg)));
    await page.reload();
  }
  await page.waitForFunction(() => window.__demo, null, { timeout: 30_000 });
  await page.waitForTimeout(800); // 첫 장 모델 굽기
  const expr = arg('--eval');
  if (expr) {
    // 마지막 문장의 값을 돌려준다. shortcut: 세미콜론으로 문장을 나누므로 문자열 안에 ';'를 쓰면 안 됨
    const parts = expr.split(';').map((s) => s.trim()).filter(Boolean), last = parts.pop();
    const out = await page.evaluate(`(async () => { ${parts.map((p) => p + ';').join(' ')} return (${last}); })()`);
    console.log(JSON.stringify(out ?? null, null, 2));
  }
  const shot = arg('--shot');
  if (shot) {
    await page.evaluate(() => window.__demo.renderOnce?.());
    await page.screenshot({ path: shot });
    console.log(`화면 저장: ${shot}`);
  }
  if (errors.length) { console.error('페이지 오류:', errors); process.exitCode = 1; }
} finally {
  await browser.close();
}
