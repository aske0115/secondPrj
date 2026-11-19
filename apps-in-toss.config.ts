// 토스(앱인토스) 미니앱 설정(docs/TOSS.md). appName은 콘솔에 등록한 값이라 바꿀 수 없다
import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'tumble-isle',
  permissions: [],
  webView: {
    bounces: false, // 끌어 움직이는 게임이라 화면이 튕기거나 당겨 새로고침되면 안 된다
    pullToRefreshEnabled: false,
    overScrollMode: 'never',
    allowsBackForwardNavigationGestures: false,
    mediaPlaybackRequiresUserAction: false,
  },
  webBundleDir: 'dist',
});
