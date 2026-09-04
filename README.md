# meta-ads-dashboard

Google Sheets(Apps Script Web App)를 데이터 소스로 쓰는 정적 대시보드.

| 파일 | 대시보드 | 소스 탭 |
|---|---|---|
| `index.html` | Meta Ads · Amazon US | `meta-raw-new`, `amz-raw-new`, `meta-ads-list` |
| `jp.html` | Meta Ads · Japan | `JP meta raw` |

공통 스프레드시트: **Amazon Dashboard (2025년~)**
`12IC6YbDR8s8lMEeUY69c5tejXbfnbdadbpugPkAGxT0`

## JP 대시보드 (`jp.html`)

- 적재: strategyeric/business-report 가 매일 KST 10:00에 D-1 데이터를 `JP meta raw` 탭에 적재
- 단위: 일 × 캠페인 × 광고세트 × 광고 / 1행 헤더, 2행부터 데이터
- 원본 컬럼 A~Q (17개): YYMMDD, 일, 캠페인 이름, 광고 세트 이름, 광고 이름, 지출 금액(원화),
  노출, 링크 클릭, 조회, 동영상 3초 이상 재생, 게시물 공감/댓글/공유/저장, ShopNowClick, 보고 시작, 보고 종료
- 페이지: Overview · By Campaign · By Ad Set · By Creative · Daily Trend
- 계산 지표는 시트에 없고 프런트에서 계산

### 지표 정의

| 지표 | 계산식 |
|---|---|
| CTR | 링크 클릭 ÷ 노출 |
| CPC | 광고비 ÷ 링크 클릭 |
| CPM | 광고비 ÷ 노출 × 1000 |
| CPA | 광고비 ÷ ShopNowClick |
| VTR | 조회 ÷ 노출 |
| 3S VTR | 동영상 3초 이상 재생 ÷ 노출 |
| ER | (공감+댓글+공유+저장) ÷ 노출 |
| 추정 구매수 | ShopNowClick × CVR |
| 추정 매출 | 추정 구매수 × 판매가(엔) × 환율(원/엔) |
| 추정 ROAS | 추정 매출 ÷ 광고비 |
| CVR(표시) | 추정 구매수 ÷ 링크 클릭 |

CVR은 **US 메타 기준 ShopNowClick → 어트리뷰션 구매 전환율**이며 기본값 5%.
상단 `추정 설정` 바에서 CVR·판매가·환율을 바꿀 수 있고 값은 브라우저에 저장된다.

### 판매가 · 환율 탭

추정 매출은 달마다 다른 판매가(프로모션)와 월평균 환율을 반영한다.
`jp.html`의 `PRICE_SHEETS` / `FX_SHEETS` 후보 이름으로 시트 탭을 찾아 읽는다.

- 인식 형식: **한 행에 「월 + 숫자」** (예: `2026-01 | 9.32`). `YYYY-MM`, `YYYY.M`,
  `2026년 1월`, `YYYYMMDD`, 날짜 셀 모두 월로 인식하고, 그 뒤 첫 숫자를 값으로 쓴다
- 안전장치: 탭 상단 4행에 `환율/엔화` · `판매가/가격` 키워드가 없으면 무시한다
  (엉뚱한 탭을 읽어 잘못된 ROAS를 내지 않도록)
- 탭을 못 찾으면 상단 입력값(판매가 기본 2,700엔, 환율 미설정)으로 대체하고,
  환율을 모르는 기간은 추정 매출·ROAS를 `—` 로 표시한다 (0으로 채우지 않음)

데이터는 브라우저 localStorage에 30분 캐시된다. 상단 `↻ Refresh`로 캐시를 지우고 다시 불러온다.

> `jp.html`은 Apps Script Web App이 `?sheet=JP meta raw` 요청을 처리한다는 전제로 동작한다.
> 스크립트에 시트 화이트리스트가 있다면 `JP meta raw`를 추가해야 한다.
