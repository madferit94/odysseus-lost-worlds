# v16 · 선택형 플레이 기록 / Opt-in play analytics

기존 v15의 난이도, 피해량, 목숨, 힐 존, 필살기 수치는 바꾸지 않습니다.
This patch adds measurement only. v15 gameplay balance is unchanged.

## 이용자 선택 / Player choice

- 게임 위의 선택란은 기본 해제입니다. 선택 후 새 게임을 시작하면 기록합니다.
- 게임 도중 켜면 다음 새 게임부터 적용합니다. 해제하면 새 전송과 재시도를 중지합니다. 이미 전송 중인 요청이나 저장된 기록까지 삭제하는 기능은 아닙니다.
- 상세 분석은 게임별 새 임의 번호를 사용하며 순위표의 브라우저 번호와 연결하지 않습니다. 이름, 이메일, IP, 전체 URL, 사용자 기기 정보는 분석 표에 저장하지 않습니다. 호스팅 서비스 자체 접속 로그와는 별개입니다.
- 기존 전체 조회수 및 온라인 순위 기능은 별개입니다. 순위 등록은 여전히 선택 사항입니다.
- 원본은 최근 90일 분석 대상입니다. 90일이 지난 원본은 다음 분석 시작 요청에서 정리합니다. 무접속 기간에는 정리가 지연될 수 있습니다. 자동 일정 기반 삭제는 아직 없습니다.

Opt in before a new game; opt out to stop future sends. Previously sent records remain under the retention policy. Analytics has no cross-run identifier and is separate from rankings, page counts and platform access logs. The export includes only the last 90 days; expired raw data is cleaned on subsequent analytics-start requests, not by a scheduled job.

## 기록 정의 / Event definitions

| 사건 | 기록 시점 |
|---|---|
| game_start | 새 여정 시작, 난이도·v16·유입 분류·테스트 구분은 play_sessions에 기록 |
| stage_start | 스테이지 입장 또는 사망 후 재개, attempt는 해당 스테이지의 0부터 시작하는 시도 번호 |
| stage_complete | 전투 종료/프롤로그 통과/에필로그 완료, 시도별 중복 없이 기록 |
| player_death / retry | HP 0 및 남은 목숨으로 실제 재개 |
| boss_start / boss_end | 보스 시도 시작 및 승리/사망, duration_ms는 해당 시도 중 게임 시간이 흐른 길이 |
| finisher_ready | 에너지가 기술 필요량 이상으로 올라온 시점, 착지·연출 종료까지 모두 준비됐다는 뜻은 아님 |
| finisher_use | 실제 발동에 성공한 기술만 기록, energy는 사용 직전 값 (제우스 200) |
| game_clear / game_over | 에필로그 완료 또는 3목숨 소진, 순위 등록 없이 저장 |
| session_hidden / session_resumed | 페이지 숨김/복귀 신호, 이탈·패배로 단정하지 않음 |

`active_ms`는 기존 게임 시계입니다. 일시정지·사망 대기는 제외하고 전투 연출·컷신·에필로그는 포함합니다. 프레임 간격 상한이 있어 느린 기기에서는 실제 벽시계 시간보다 짧을 수 있습니다. `received_at`은 서버 수신 UTC epoch 초입니다. 마지막 사건 시간은 전체 최종 플레이 시간의 하한입니다.

Boss attempts restart after a death; enemies keep their damage. Attempt 2 is therefore not a fresh full-health boss fight. Compare first-attempt success separately. Ready events measure the energy threshold, not all castability conditions.

## 유입 링크 / Source links

공개 게임 주소 뒤에 `?utm_source=x`, `?utm_source=reddit`, `?utm_source=linkedin`을 붙입니다. `twitter`는 `x`로 정규화하고 그 밖의 값은 `other`로만 저장합니다. 매개변수 없음은 `direct` 분류이며 실제 직접 입력 유입을 증명하지 않습니다. 전체 URL이나 referrer는 저장하지 않습니다.

이번 버전은 동의한 **게임 시작 이후**의 유입별 진행 분석을 지원합니다. 채널별 전체 방문 수·동의하지 않은 사람·순 방문자 수·재방문율은 측정하지 않습니다. 기존 조회수와 나누어 엄밀한 유입 전환율로 해석하지 마세요.

## 전송 품질 / Data quality

- 한 번에 최대 10건, 게임당 최대 2,000건, 미전송 메모리 대기열 최대 500건.
- 같은 게임 번호와 사건 순서의 재전송은 한 건만 저장합니다. 저장 확인 응답을 받아야 화면에 저장 완료를 표시합니다.
- 네트워크 복구와 지연 재시도를 지원합니다. 8초 요청 제한, 최대 30초 재시도 간격. 장시간 오프라인·강제 종료·한도 도달 시 누락될 수 있습니다. 24시간이 지난 여정은 새 기록을 받지 않습니다.
- 새로고침 후 미전송 기록은 복구하지 않습니다. 분석 중 사건 순서 누락, 시작 사건 누락, 최종 결과 미확인을 따로 확인해야 합니다. 종료 직전 마지막 사건 누락은 순서 검사만으로 발견할 수 없습니다.
- 클라이언트 보고 데이터이므로 조작·자동 방문·자가 신고된 test 플래그를 완벽히 차단하지 않습니다. 사용자 행동의 참고 자료이며 대회 상금 정산 등에 쓰지 마세요.

## 운영자 CSV / Operator-only export

공개 데이터 조회 또는 CSV 다운로드 경로는 만들지 않았습니다. **사이트 소유자의 인증된 Sites DB 조회**로만 가져와 로컬에서 CSV를 만듭니다. 플레이어에게 원본을 보여주지 않습니다.

1. 소유자 연결로 DB 구조를 확인한 뒤 `play_sessions`, `play_events`의 모든 페이지를 읽습니다. 반환된 다음 페이지 값만 사용합니다.
2. 토큰 해시를 제외하고 `{complete:true,sessions:[...],events:[...]}` 형태로 `.analytics-private/` 아래 새 JSON 파일에 저장합니다. 조회 중에도 계속 수집되는 자료이므로 이는 완전한 트랜잭션 시점 스냅샷이 아닙니다. 사건에 연결된 시작 기록 누락을 재확인합니다.
3. `node export-analytics.mjs <snapshot.json> <새 출력 폴더>`를 실행합니다. 기본값은 `is_test=0`만 포함합니다. QA 확인에 한해 `--include-tests`를 붙입니다.
4. `sessions.csv`는 여정별 요약, `events.csv`는 행동별 자료입니다. 기존 출력 폴더에는 덮어쓰지 않습니다. 원본과 CSV는 Git에 올리지 않습니다.

`outcome=unknown`은 진행 중·종료 미확인·수집 중지 등을 모두 포함합니다. 실패율 분모에 무조건 넣지 마세요. `missing_sequences`, `has_start`, `terminal_conflict`로 자료 상태를 확인하고, 버전·난이도·테스트 여부를 나누어 분석합니다. 전후 비교는 관찰 자료이며 인과 효과를 확정하지 않습니다.

## 검사 / Verification commands

`node test-game.cjs`, `node --test test-worker.mjs test-telemetry.mjs`, `node build.mjs`.
이 저장소에서는 게임 파일이 현재 폴더에 있습니다. `node build.mjs`로 배포용 Worker를 만들 수 있습니다. 테스트는 Node.js 24 이상이 필요합니다.
테스트 플레이는 `?test=1` 주소로 열고 동의 후 시작합니다. 자동 시뮬레이션과 실제 브라우저 수동 플레이는 구분하여 기록합니다.
