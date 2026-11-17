# iOS 빌드 (결정 017)

웹 게임(`dist`)을 Capacitor 8로 감싼 앱입니다. Xcode 프로젝트는 `ios/App/App.xcodeproj`(Swift Package Manager, CocoaPods 없음).

## 정보
| 항목 | 값 |
|---|---|
| 번들 ID | `kr.co.daeun.tumbleisle` (결정 054에서 `secondprj`에서 바꿈. App Store Connect 등록 뒤에는 못 바꿈) |
| 앱 표시 이름 | 한국어 기기 **망치섬**, 그 밖 **Tumble Isle** — `ios/App/App/ko.lproj`·`en.lproj`의 `InfoPlist.strings`(기본값은 `Info.plist`의 Tumble Isle) |
| 버전 | 1.0 (`MARKETING_VERSION`), 빌드 1 |
| 최소 iOS | 15.0 |
| 방향 | iPhone 세로 고정, iPad 전체 방향·전체 화면(`UIRequiresFullScreen`) |
| 상태 표시줄 | 숨김 |
| 수출 규정 | `ITSAppUsesNonExemptEncryption = NO` |
| 서명 | **직접 설정**: Xcode → App 타깃 → Signing & Capabilities → Team 선택(자동 서명) |
| 플러그인 | `@capacitor/haptics`(앱에서는 네이티브 진동, 웹은 `navigator.vibrate`) |

## 실행
```bash
npm run ios          # 웹 빌드 → iOS 동기화 → Xcode 열기
```
Xcode에서 Team을 고르고 기기를 선택해 실행합니다. 웹 코드만 바꿨을 때는 `npm run native` 뒤 Xcode에서 다시 실행하면 됩니다.

서명 없이 시뮬레이터로만 확인할 때:
```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App -sdk iphonesimulator \
  -configuration Debug -derivedDataPath ../DerivedData CODE_SIGNING_ALLOWED=NO build
```

## 확인한 것(2026-11-16, iPhone 17 Pro 시뮬레이터 iOS 26.5)
- 서명 없는 시뮬레이터 빌드 성공, 실행·첫 화면, Dynamic Island 아래로 쪽지 카드 배치(안전 영역)
- 실제 터치로 벽시계 누르기 → 가까이 보기 → 문질러 닦기 → 초침 움직임

## 아직 확인 못 한 것
- 실기기 성능·발열·햅틱 느낌, 무음 스위치에서 소리(웹 오디오는 무음 스위치를 따름)
- 앱 아이콘·시작 화면(지금은 Capacitor 기본값)
