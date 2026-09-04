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
- 계산 지표는 시트에 없고 프런트에서 계산: CTR, CPC, CPM, VTR(3초 재생율),
  Engagement(공감+댓글+공유+저장), ER, ShopNow 전환율(SN%), Cost/ShopNow, Cost/Engagement
- 페이지: Overview · By Campaign · By Ad Set · By Creative · Daily Trend
- 구매/매출 컬럼이 없으므로 ROAS·CPA 지표는 제공하지 않음

데이터는 브라우저 localStorage에 30분 캐시된다. 상단 `↻ Refresh`로 캐시를 지우고 다시 불러온다.

> `jp.html`은 Apps Script Web App이 `?sheet=JP meta raw` 요청을 처리한다는 전제로 동작한다.
> 스크립트에 시트 화이트리스트가 있다면 `JP meta raw`를 추가해야 한다.
