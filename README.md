# 6T — 서버에서 이어지는 6인 티츄

게임: https://tichu6.pages.dev/

Vue 3·TypeScript·Pinia 화면과 Vite 정적 빌드는 Cloudflare Pages, 게임 서버는 Workers + SQLite Durable Objects를 사용합니다. 공개 대기실과 최대 5개 방을 하나의 Durable Object가 관리하고, 서버가 셔플·규칙 판정·게임 상태 저장을 담당합니다. PeerJS/WebRTC는 사용하지 않습니다.

시작 화면과 공개 대기실의 **봇 5명과 연습하기** 버튼으로 혼자 연습할 수 있습니다. 다른 다섯 좌석은 봇이 자동으로 플레이합니다.

작은 화면에서는 손패 18장을 6열×3줄로 표시합니다. 카드 선택은 테두리와 순서 표시로 확인하며, 가로로 스크롤하거나 겹친 카드를 펼칠 필요가 없습니다. 카드 그림 원본·스프라이트와 재생성 방법은 [에셋 문서](src/assets/cards/README.md)에 있습니다.

## 참가와 복구

- 초대 코드 없이 공개 대기실에서 방을 선택합니다. 전체 접속자는 플레이어·관전자를 합쳐 최대 30명, 방은 최대 5개, 플레이어는 방마다 6명입니다.
- 방 제목은 자동 생성하고 닉네임은 영문 대소문자·숫자만 사용해 1~8자로 지정합니다 (공백·한글·특수문자 불가). 관전자는 각 플레이어의 현재 손패·공개 카드·점수·차례를 볼 수 있습니다. 라지 티츄 단계에는 첫 10장만 공개하며, 교환 선택·교환 내역·인증 정보는 공개하지 않습니다.
- 참가 키는 브라우저 localStorage에 저장하고 서버에는 SHA-256 해시만 보관합니다. 초대 링크에 참가 키를 넣지 않습니다.
- 새로고침은 자동 복구합니다. 진행 중인 방에서 대기실로 나와도 방 목록의 복귀 버튼으로 돌아갈 수 있습니다.
- 같은 브라우저의 다른 탭으로 복귀하면 기존 연결을 교체합니다. 여러 명 테스트는 별도 브라우저 프로필을 사용하세요.
- 브라우저 데이터 삭제·다른 기기에서는 복구할 수 없습니다. 회원 계정이나 기기 간 복구 코드는 아직 없습니다.
- 방장이 나가도 게임은 유지됩니다. 현재 연결된 가장 앞 좌석이 시작/다음 라운드 담당자가 됩니다.
- 플레이 중 연결이 끊기면 끊긴 시점부터 최대 3분 대기 후 30초 제한으로 자동 패스합니다(패스 불가 시 합법적인 자동 플레이). 먼저 복귀하면 복귀 시점부터 30초이며, 같은 차례의 반복 재접속은 시간을 연장하지 않습니다. 대기실·선언·교환 단계는 기존 45초 유예를 유지합니다.
- 방 생성 또는 마지막 정상 게임 행동(봇 포함) 이후 30분간 진행이 없으면 접속자 유무와 관계없이 방을 종료합니다. 입장·관전·재접속·핑은 시간을 연장하지 않으며, 남아 있는 참가자는 라운지로 돌아갑니다.

## 실행과 검증

```sh
npm ci
npm run dev
npm run dev:server
npm test
npm run check
npm run test:server
```

Node.js 22.13 이상을 사용합니다. `npm run dev`는 5173 포트에서 화면을 제공합니다. localhost 화면은 자동으로 로컬 8787 서버에 연결합니다. 서버 통합 검증은 기본적으로 로컬 8787을 사용하며 `TEST_API`로 다른 로컬 포트를 지정할 수 있습니다. 용량 검증은 운영 주소를 거부합니다. 매 실행마다 비어 있는 로컬 저장소를 사용하세요.

## 배포

- Pages: `main` 푸시 시 자동 배포. 빌드 명령 `npm run build` (`public/_headers` 포함), 출력 `dist`.
- 서버: `npx wrangler@4 login` 이후 `npm run deploy:server`. Worker 변경은 Pages 배포와 별도로 이 명령을 실행해야 합니다.
- `wrangler.jsonc`의 SQLite migration `v1`은 최초 생성용이며 이미 저장된 방은 재배포 후에도 유지됩니다. 상태 스키마 변경 시 별도 마이그레이션이 필요합니다.
- 서버 주소: https://tichu6-server.kelp-swaths-7q.workers.dev
- Workers Free + SQLite Durable Objects를 대상으로 합니다. 무료 할당량을 초과하면 서비스가 제한될 수 있습니다. 요금제 변경은 별도로 하지 않습니다.

## 연결과 권한

서버는 인증된 WebSocket 연결로 좌석을 식별하고, 요청에 담긴 좌석 ID를 신뢰하지 않습니다. 참가자에게 자신의 패와 공개 정보만 전달합니다. 모든 행동의 revision·소유권·차례·조합을 검증하고 저장 후 전파합니다. 대기 중 연결은 WebSocket Hibernation을 사용합니다. 공개 서비스 전체를 대상으로 하는 DDoS/사용자별 쿼터 방어와 계정 인증은 이 친구용 버전의 범위 밖입니다.

## 적용한 규칙

- 일반 카드 52장 × 2 + 용·봉·개·새 각 1장 = **108장**, 18장씩 배분.
- 좌석 순서 1~6: **A–B–A–B–A–B**. 순서는 좌석 번호가 증가하는 방향.
- 같은 숫자의 복제 카드도 각각 별도 ID를 가집니다.
- 싱글, 페어, 트리플, 풀하우스, 5장 이상 스트레이트, 2개 이상 연속 페어.
- 숫자 폭탄은 **정확히 4장**. 문양이 같아도 복제 카드 4장이면 허용합니다. 5~8장의 같은 숫자 묶음은 불허합니다.
- 스트레이트 폭탄은 같은 문양으로 연속된 5장 이상. 숫자 폭탄보다 높고, 길이 → 최고 숫자 순으로 비교합니다. 같은 세기의 폭탄은 이길 수 없습니다. 봉으로 폭탄을 만들 수 없습니다.
- 차례 밖 폭탄 가능. 모두 패스하면 마지막 제출자가 **트릭 확정**을 누르며, 그 전에는 폭탄을 낼 수 있습니다. 동시에 도착한 행동은 서버에 도착한 순서로 처리하며 오래된 상태에서 보낸 요청은 재시도를 요구합니다.
- 새: 선 플레이어 결정, 1로 스트레이트 참여, 2~A 소원. 자기 차례에 소원을 실물 카드로 이행할 수 있으면 반드시 이행합니다. 봉 조합과 폭탄 가능성도 확인합니다. 차례 밖 폭탄에는 소원 의무가 없습니다.
- 개: 선에서만 단독 사용. 두 팀원 중 선택하며, 선택한 팀원이 끝났으면 그 다음 남은 플레이어에게 선을 넘깁니다.
- 봉: 조합에서 2~A 대체. 싱글은 직전 싱글 +0.5, 선이면 1.5. 용은 이길 수 없습니다. 조합에서 대체 숫자를 직접 고를 수 있습니다.
- 용: 최강 싱글, 폭탄에는 패배. 용이 이긴 트릭은 선택한 상대 팀원에게 전달합니다.
- 티츄: 자기 첫 제출 전 선언, 개인 1등 성공 시 +100, 실패 −100.
- **이 버전에서 정한 기본값:** 처음 10장만 공개하고 라지 티츄(±200)를 결정한 뒤 나머지 8장 공개. 팀원 둘에게 한 장씩 동시에 교환. 첫 세 완주자가 같은 팀이면 즉시 트리플 승리 300점. 1,000점 도달 시 높은 팀 승리, 동점은 다음 라운드.
- 일반 점수: 5는 5점, 10·K는 10점, 용 +25, 봉 −25. 더블 덱의 카드 점수 총합은 **200점**. 마지막 사람의 손패 점수는 상대 팀으로, 획득 트릭은 1등에게 이전합니다. 트리플 승리는 카드 점수를 세지 않고 300점을 부여하며 선언 점수는 별도입니다.

공식 Tientsin 변형과 사용자 지정 더블 덱 6T를 구분합니다. 첫 공개 장수, 교환, 트리플 보너스는 더블 덱의 공인 규칙이라고 주장하지 않으며 위 기준으로 고정한 첫 구현입니다.

## 구조

- `server/worker.ts`: Hono HTTP 라우팅, Origin/연결 빈도 검사, 기존 GameRoom 보존
- `server/lounge.ts`: Durable Object 이벤트·동시 실행 제어·저장 후 응답
- `server/{session,room,game,lifecycle,persistence,transport}/`: 인증·방 관리·게임 진행·만료·저장·메시지 검증 서비스
- `src/server-room.ts`: 연결, 자동 재접속, 참가 키 보관
- `src/game.js`: 서버/연습 공용 규칙 엔진
- `src/App.vue`, `src/views/`, `src/components/`: 한국어·영어 Vue 화면
- `src/stores/session.ts`: Pinia 연결·게임·연습 상태
- `src/types.ts`: 클라이언트 메시지·게임 타입
- `tests/ui/`: Vitest + Vue Test Utils 화면·재접속 회귀 테스트
- `tests/server.test.js`: 복구, 봇, 만료, 권한 검증
- `scripts/check-lounge.mjs`: 실제 31개 연결, 방 정원, 관전 권한, 재접속 통합 검증
- `tests/lounge.test.js`: 동시 입장, 개인정보 차단, 요청 제한 검증
- `scripts/check-server.mjs`: 구버전 전용 검증 스크립트 (현재 서버에는 사용하지 않음)

참고: [Durable Objects](https://developers.cloudflare.com/durable-objects/), [무료 사용량](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## v0.4 전환 및 보안

`v2` migration은 Lounge 클래스를 추가하며 기존 GameRoom 저장소를 삭제하지 않습니다. 구버전 방은 새 대기실로 자동 이전되지 않으며 구버전 HTTP 경로는 410을 반환합니다. 배포 후 새로고침하고 새 방을 만들어야 합니다.

서버가 정원·좌석·차례·행동을 검증합니다. 연결 시도는 IP별 분당 120회, 연결별 메시지는 10초당 30회로 제한합니다. 메시지 길이는 4096 코드 단위, 미인증 연결은 10초로 제한합니다. IP 제한은 Cloudflare 위치별 근사 제한이며 계정 인증을 대신하지 않습니다. 익명 참가 키 하나가 한 사용자이므로 서로 다른 키를 만든 동일인을 구별하지는 못합니다.

개발 재개는 `AGENTS.md`, 기여 절차는 `CONTRIBUTING.md`, 미완료 작업과 배포 상태는 `docs/STATUS.md`를 확인하세요.

## 언어 지원

한국어·영어를 지원하며 상단 언어 선택은 브라우저에 저장됩니다. 처음에는 브라우저 언어를 감지하고 지원되지 않는 언어는 영어로 표시합니다. i18next와 i18next-browser-languagedetector를 사용하며 문구는 `src/locales/ko.json`, `src/locales/en.json`에서 의미 있는 코드 키로 관리합니다. 오류와 새 게임 기록은 `{code, params}` 형식으로 보관하여 언어 전환 시 다시 표시합니다. 기존 버전에서 저장한 문자열 기록과 방 제목은 원문을 보존합니다.

언어 추가는 JSON 언어팩과 `src/locales/index.js` 등록으로 가능합니다. 브라우저 배포물은 Vite가 라이브러리를 포함한 정적 파일로 생성합니다. 로컬 화면은 `npm run dev`로 실행합니다.

## 개발 기준

프런트엔드는 Vue SFC·strict TypeScript·Pinia로 구성합니다. 운영 Workers 서버는 Hono + strict TypeScript 서비스로 구성하고, Cloudflare가 생성한 타입으로 별도 검사합니다. 공용 규칙 엔진과 기존 GameRoom 호환 모듈은 JavaScript를 유지하며 선언 파일과 회귀 테스트를 적용합니다. 이 두 JavaScript 구현 자체는 TypeScript 검사 대상이 아닙니다.

`npm run check`는 ESLint(경고 0개)와 vue-tsc를 실행합니다. `npm test`는 기존 서버/규칙 테스트와 Vue UI/연결 테스트를 실행하고, `npm run format:check`로 Prettier 형식을 검증합니다. GitHub Actions에서도 같은 검증과 로컬 Worker 통합 테스트를 실행합니다.

Vite 개발·배포 JavaScript 대상은 **ES2026**입니다. 현재 안정 버전 TypeScript 6.0.3에는 ES2026 이름의 target/lib가 없어 타입 검사만 ESNext를 사용합니다. CSS 호환 대상은 별도 설정합니다. 기존 세션 키와 서버 프로토콜을 유지하므로 프런트엔드 교체 후 같은 브라우저에서 재접속할 수 있습니다.

빈 좌석은 게임 시작 시 봇으로 채웁니다. 새 게임의 팀은 사람·봇 수가 양쪽에서 최대 한 명 차이 나도록 균등하게 무작위로 정하고 라운드 사이에는 유지합니다. 봇은 접속자 30명 제한에 포함하지 않으며, 실제 플레이어가 모두 접속을 끊으면 진행을 멈춥니다.

### Bot strategy

Practice and server bots share the same strategy in `src/game.js`. They exchange
low singleton ranks, preserving rank and straight-flush bombs. A partner who has
already declared Large or Small Tichu receives the best available non-bomb card:
phoenix, ace, dragon, king, then queen. If both partners have declared, exchange
recipient order breaks the tie. Declarations after a submitted exchange cannot
change that exchange. If fewer than two non-bomb cards exist, the mandatory
two-card exchange takes precedence so the round can proceed.

With mahjong, bots wish for an ordinary card received from a partner (A if none
is available). They prefer shedding low loose singles, retain made combinations
and aces, conserve scoring cards, and use stronger singles on valuable tricks.
They generally pass over teammates and reserve bombs for taking valuable tricks
or stopping opponents with at most two cards. Mandatory wishes and immediate
finishes take precedence; a hand consisting only of a bomb can finish on lead.
These are heuristics using the bot's own cards, received exchange cards and public
state, not a measured win-rate guarantee or access to other players' hidden hands.

게임 플레이는 반시계 방향으로 진행합니다. 내 다음 좌석은 테이블 오른쪽에 표시되며, 관전자에게도 같은 방향으로 표시됩니다.

### Thirty-minute idle logout

The server logs out players, spectators and lounge visitors after 30 minutes
without an accepted room or game request. Explicit entry, room creation/join/leave,
and valid game actions count as activity. Heartbeat ping/pong, broadcasts, invalid
requests and automatic reconnects do not reset the deadline. Clicking or selecting
cards locally without submitting an action does not count as a server action.

Idle sockets lose authorization and close with code 4009, freeing a connected-user
slot. Waiting seats are removed. During a match the seat immediately becomes
bot-controlled, without the ordinary disconnect grace period. If all
humans become idle, bots finish the current round; they do not start new rounds
without a user. Rooms expire 30 minutes after creation or the last accepted game action (including bots), even with connected users. Joining, watching, reconnecting and pinging do not extend this deadline. Connected occupants return to the lounge. Existing rooms receive a full 30-minute window when this policy first loads.

The client returns to the entry screen and stops automatic reconnection, including
after reload. Explicit entry reuses private local credentials to recover the same
seat and remaining hand. Idle timestamps and takeover flags persist privately in
the Durable Object; snapshots expose only the existing bot indicator. Old stored
rooms migrate without losing hands, with a fresh idle window for existing sockets.
Run `npm run test:idle` for the isolated real-Worker timeout/reconnect regression;
its clock-aging fixture is never imported by the production Worker.

### Exchange receipt, giving up and combination labels

Players see a private receipt pairing each teammate with the card sent and the
card received. Sent cards appear after submitting the exchange; incoming cards
appear only once all six exchanges finish. The receipt disappears after that
player's first accepted play or the first collected trick, whichever comes first,
and stays hidden after reconnect. Spectator snapshots never contain receipts.

During an active game, **Give up game** opens a warning with cancel/Escape support.
Confirming returns to the lounge and permanently transfers that seat to a server
bot; scores, teams and declarations remain unchanged. The departing identity can
watch but cannot reclaim the surrendered seat. Other human players keep playing;
rooms with no human members are removed. Practice surrender ends the local game.
Normal connection loss and IDLE reconnect rules remain separate from surrender.

The table identifies the last player with a team-colored A/B label. Table labels,
selection previews and new history entries include ranks or ranges, e.g. `10 pair`,
`10 full house` (triple rank), `6 four of a kind`, `5–J straight`, and
`3–10 straight flush`. Older history records retain their generic labels.

### 연습 게임 이어하기

‘혼자서도 바로 플레이’의 연습 게임은 같은 브라우저의 로컬 저장소에 자동 저장됩니다.
새로고침하거나 사이트에 다시 접속하면 패, 점수, 선언, 교환과 진행 차례를 복원하고
봇이 이어서 진행합니다. 게임 포기를 확정하면 저장도 삭제됩니다.
서버 방의 접속 정보와 별도로 저장하며 서버로 전송하지 않습니다. 브라우저 데이터를
삭제하거나 저장소를 차단하면 복원할 수 없습니다. 기존 버전에서 이미 사라진 게임은 복구되지 않습니다.

콜이 유지된 상태에서 앞선 폭탄을 이기는 콜 포함 폭탄이 현재 차례 플레이어에게 있으면, 그 플레이어가 직접 폭탄을 선택해 내야 합니다. 이때 다른 플레이어의 끼어들기 폭탄은 거부됩니다. 해당 폭탄이 없거나 더 약하면 끼어들기를 제한하지 않습니다.
