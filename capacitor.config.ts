import type { CapacitorConfig } from '@capacitor/cli';

// iOS 앱은 같은 웹 게임(dist)을 감싼다(결정 013).
// 번들 ID는 게임 이름이 정해지면 App Store Connect 등록 "전에" 바꾼다. 등록 뒤에는 바꿀 수 없다(쓸어킬은 neonrush로 남음).
const config: CapacitorConfig = {
  appId: 'kr.co.daeun.secondprj',
  appName: 'secondPrj',
  webDir: 'dist',
  backgroundColor: '#241b14',
  ios: { contentInset: 'never' },
};

export default config;
