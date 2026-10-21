# 게임 폴더 안내

[English](README.md) · **한국어**

이 폴더에는 브라우저 게임과 서버 코드가 있습니다. 게임 소개와 조작법은 [프로젝트 소개](../README.ko.md)에서, 버전별 변경 사항은 [업데이트 내역](../CHANGELOG.ko.md)에서 확인할 수 있습니다.

## 폴더 구성

| 경로 | 하는 일 |
| --- | --- |
| `index.html`, `display.css` | 게임 화면과 배치 |
| `game.js` 등 `*.js` 파일 | 이동, 전투, 보스, 필살기, 화면 표시, 순위, 조회수, 선택형 플레이 기록 |
| `display.js` | v17 도구 모음: 전체 화면, 접을 수 있는 조작 안내, 언어·소리 버튼 |
| `assets/` | 게임 이미지 |
| `server/worker.mjs` | 온라인 순위와 조회수 서버 |
| `server/telemetry.mjs` | 선택형 플레이 기록 서버 |
| `db/`, `drizzle/` | 데이터베이스 표 구조와 변경 이력 |
| `export-analytics.mjs` | 운영자 전용 도구. 기록 사본을 CSV 파일로 만듭니다 |
| `test-game.cjs`, `test-*.mjs` | 자동 검사 |
| `build.mjs` | 배포용 게임과 서버를 `dist/`에 묶습니다 |
| `TELEMETRY-v16.ko.md` | 선택형 플레이 기록의 수집 항목과 운영자 내보내기 방법 |

## 내 컴퓨터에서 실행하기

컴퓨터 브라우저에서 `index.html`을 엽니다. 게임을 보고 플레이하는 데에는 설치가 필요 없습니다.

**온라인 순위·조회수·플레이 기록은 공개 사이트의 서버와 데이터베이스가 있어야 동작합니다.** 파일을 직접 열거나 다른 웹 호스팅에 올리면 게임은 실행되지만, 이 기능들은 불러오거나 저장하지 못합니다.

## 검사와 빌드

이 폴더에서 Node.js 24 이상으로 실행합니다.

```sh
npm test          # 게임·화면·서버·플레이 기록 검사
node build.mjs    # 배포용 게임과 서버를 dist/에 만듭니다
```

`npm test`는 `npm install` 없이 실행됩니다. `dist/`는 빌드 결과물이라 Git에 올리지 않습니다. `node build.mjs`는 기존 공개 사이트 프로젝트를 가리키는 `.openai/hosting.json`을 읽습니다. 다른 계정에서 배포하려면 자신의 프로젝트와 데이터베이스를 따로 준비해야 합니다.

## 다른 문서

- [프로젝트 소개 (한국어)](../README.ko.md) · [Project introduction (English)](../README.md)
- [업데이트 내역 (한국어)](../CHANGELOG.ko.md) · [CHANGELOG (English)](../CHANGELOG.md)
- [플레이 기록 안내 (한국어)](TELEMETRY-v16.ko.md) · [Play analytics guide (English)](TELEMETRY-v16.md)
