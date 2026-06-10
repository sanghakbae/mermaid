# Firebase 설정 가이드

이 앱은 Firebase Auth(Google 로그인) + Firestore로 **내 다이어그램 저장/목록** 기능을 지원합니다.
Firebase 설정이 없으면 기존처럼 동작하고 로그인 UI만 자동으로 숨겨집니다.

## 1. Firebase 프로젝트 만들기

1. [Firebase 콘솔](https://console.firebase.google.com)에서 새 프로젝트를 만듭니다.
2. **빌드 > Authentication > 시작하기**에서 제공업체를 활성화합니다.
   - **Google** — 다른 기기에서도 불러올 수 있는 영구 로그인
   - **익명(Anonymous)** — 로그인 없이도 자동 저장이 동작하려면 **반드시** 활성화
3. **빌드 > Firestore Database**를 만듭니다(프로덕션 모드 권장).

## 2. 웹 앱 등록 & 설정값 복사

1. 프로젝트 설정(⚙️) > **내 앱**에서 웹 앱(`</>`)을 추가합니다.
2. 표시되는 `firebaseConfig` 값을 프로젝트 루트의 `.env` 파일에 채웁니다.

```bash
cp .env.example .env
```

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

> `.env`는 `.gitignore`에 포함되어 커밋되지 않습니다. (이 키들은 클라이언트에 노출되는 공개 키이며, 실제 보안은 아래 보안 규칙으로 합니다.)

## 3. 보안 규칙 적용

`firestore.rules` 내용을 **Firestore Database > 규칙** 탭에 붙여넣고 게시합니다.
로그인한 사용자가 본인 소유(`uid` 일치) 문서만 읽고 쓸 수 있도록 제한됩니다.

## 4. 승인된 도메인 등록

**Authentication > 설정 > 승인된 도메인**에 배포 도메인과 `localhost`를 추가합니다.
그래야 로그인 팝업이 동작합니다.

- `mermaid.sanghak.kr`
- `localhost`

## 4-1. Cloudflare Pages 배포 시 환경변수

`.env`는 `.gitignore`에 있어 저장소에 올라가지 않으므로, Cloudflare Pages에서는
**Settings > Environment variables**에 동일한 `VITE_FIREBASE_*` 키들을 등록해야 합니다.
(Vite는 빌드 타임에 값을 주입하므로 Production/Preview 양쪽에 모두 추가)

## 5. 인덱스

목록은 `where(uid) + orderBy(updatedAt desc)` 쿼리를 사용합니다.
처음 실행 시 Firestore가 복합 인덱스 생성 링크를 콘솔/에러로 안내하면 한 번 클릭해 생성하면 됩니다.

## 사용 방법 (자동 저장)

- 접속하면 **익명 사용자로 자동 로그인**되어 신원이 생깁니다(로그인 불필요).
- 코드를 입력하거나 **붙여넣으면** 약 1초 후 **자동으로 저장**됩니다. 헤더에 `저장 중… → 자동 저장됨` 표시.
- 같은 문서는 계속 덮어쓰기되고, **새 문서**를 누른 뒤 편집하면 별도 항목으로 저장됩니다.
- 제목을 비워두면 코드에서 자동으로 추론합니다(직접 입력해 덮어쓸 수 있음).
- **내 다이어그램** 버튼으로 목록을 열어 클릭하면 불러오기, **삭제**로 제거.
- 익명 저장본은 **같은 브라우저**에서 유지됩니다. **Google로 로그인**하면 기존 익명 데이터가
  그대로 연결되어 다른 기기에서도 보입니다.
