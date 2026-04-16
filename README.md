# Mermaid Live Editor

React + Vite + Mermaid 기반의 실시간 다이어그램 편집기입니다.

왼쪽에서 Mermaid 코드를 작성하면 오른쪽에서 즉시 다이어그램을 렌더링합니다. 코드 편집과 프리뷰 기반 라벨 편집을 함께 지원하고, 결과물은 `PNG`와 `MMD` 파일로 각각 내려받을 수 있습니다.

## 주요 기능

- Monaco Editor 기반 Mermaid 코드 편집
- 코드 입력 시 실시간 프리뷰 렌더링
- 문법 오류 라인 표시 및 Syntax Guide 안내
- 프리뷰 확대/축소
  - `Windows/Linux`: `Alt + Scroll`
  - `macOS`: `Option + Scroll`
  - 보조 조작: `Ctrl/Cmd + Scroll`, `+/-` 버튼
- 코드/프리뷰 패널 비율 드래그 조절
- 프리뷰 도형/라벨 클릭 후 텍스트 수정 팝업
- `PNG`, `MMD` 개별 다운로드
- GitHub Pages 배포 지원

## 기술 스택

- React
- Vite
- Mermaid
- Monaco Editor

## 로컬 실행

```bash
npm install
npm run dev
```

기본 개발 서버:

```text
http://127.0.0.1:5173/
```

## 빌드

```bash
npm run build
```

빌드 결과물은 `dist/`에 생성됩니다.

## 다운로드 방식

현재 다운로드는 두 버튼으로 분리되어 있습니다.

- `Download PNG`: 현재 프리뷰를 2배 해상도 PNG로 저장
- `Download MMD`: 현재 코드 내용을 `.mmd` 파일로 저장

브라우저 환경에 따라 저장 위치 선택 팝업 대신 기본 다운로드 폴더로 바로 저장될 수 있습니다.

## GitHub Pages 배포

이 저장소는 GitHub Pages용 Actions workflow를 포함합니다.

- workflow 파일: `.github/workflows/deploy.yml`
- Vite base 경로: `/mermaid/`

배포 대상 URL:

```text
https://sanghakbae.github.io/mermaid/
```

Pages가 처음 켜지는 경우에는 GitHub 저장소 설정에서 아래 항목이 맞아야 합니다.

1. `Settings`
2. `Pages`
3. `Source: GitHub Actions`

`main` 브랜치에 push 되면 Actions가 빌드 후 Pages에 배포합니다.

## 프로젝트 구조

```text
src/
  App.jsx
  main.jsx
  styles.css
vite.config.js
```

## 참고 사항

- 다운로드 동작은 브라우저 정책 영향을 받습니다.
- PNG 저장은 투명 배경 기준으로 생성됩니다.
- 프리뷰 편집은 Mermaid가 생성한 SVG 구조에 의존하므로, 다이어그램 타입에 따라 동작 차이가 있을 수 있습니다.
