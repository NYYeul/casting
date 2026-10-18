# MVP 기술 스택 권장안

**상태:** 팀 승인 전 권장안  
**작성 기준:** 2026년 10월 13일

## 권장 구성

| 영역 | 권장안 | 이유 |
| --- | --- | --- |
| 모바일 PWA와 서버 | Next.js App Router + TypeScript | 제작자·배우의 모바일 화면과 HTTP 처리 코드를 한 저장소에서 관리. Route Handler로 [API 계약](DATA_API_CONTRACT.md)의 경로를 구현할 수 있음 |
| 인증 | Supabase Auth 이메일 일회성 링크 | 별도 앱 설치나 비밀번호 생성 없이 제작자·배우의 이메일 소유를 확인할 수 있음 |
| 데이터 | Supabase Postgres | 프로젝트→배역→지원서→평가→후보 목록의 관계와 제약을 명확히 표현 |
| 파일 | Supabase Storage 비공개 버킷 | 지원 사진의 접근을 권한 정책으로 제한. 연기 영상은 MVP에서 링크 제출 우선 |
| UI·계약 검사 | React 컴포넌트 + TypeScript 타입 + 입력 검증 스키마 | 화면과 서버가 같은 필드·오류 규칙을 사용 |
| 테스트 | 도메인 단위 검사, 권한 통합 검사, 브라우저 과업 검사 | PRD의 완료 기준과 비공개 자료 보호를 검증 |

Next.js는 App Router의 `route.ts`로 HTTP 요청을 처리할 수 있고, Supabase는 Next.js 인증 예시와 이메일 링크·OTP 흐름을 제공한다. 비공개 Storage 버킷은 접근 정책 또는 짧은 유효기간의 서명 URL이 필요하다. [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers), [Supabase Next.js Auth](https://supabase.com/docs/guides/auth/quickstarts/nextjs), [Supabase 이메일 로그인](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Supabase 비공개 버킷](https://supabase.com/docs/guides/storage/buckets/fundamentals)을 기준으로 검토했다.

### PWA 요구사항

- Next.js의 `app/manifest.ts`로 앱 이름, 아이콘, 시작 경로, `standalone` 표시 방식을 정의한다. HTTPS에서 홈 화면 설치를 확인한다. [Next.js PWA 가이드](https://nextjs.org/docs/app/guides/progressive-web-apps), [MDN 설치 조건](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable)
- 설치 유도는 첫 지원·검토를 막지 않는다. iPhone과 Android의 설치 동작이 다르므로 기기별로 확인한다.
- 서비스 워커는 정적 앱 셸에 한정해 검토한다. 지원서·사진·메시지 같은 비공개 응답을 기본 캐시에 넣지 않는다. MVP는 오프라인 쓰기·자동 동기화를 제공하지 않는다.
- 푸시 알림은 채팅·일정 기능과 함께 후속 단계에서 결정한다. MVP 결과 안내는 이메일을 기본으로 한다.

## 권장 구조

```text
app/
  manifest.ts                        홈 화면 설치 정보
  (public)/roles/[slug]/            공개 배역·모바일 지원 화면
  (actor)/me/applications/           배우 본인 모바일 지원 내역
  (producer)/projects/              제작자 모바일 프로젝트·배역·지원자 화면
  api/                              데이터와 API 계약의 Route Handlers
features/
  roles/                            배역 입력·게시·마감
  applications/                     지원서 입력·조회
  review/                           조건 판정·내부 평가·후보 목록
  outcomes/                         공개 결과·알림
lib/
  auth/                             현재 사용자 확인
  db/                               DB 접근과 권한 확인
  validation/                       입력 스키마
supabase/
  migrations/                       버전 관리하는 DB 변경
  tests/                            역할별 허용·거절 정책 검사
tests/e2e/                          핵심 브라우저 흐름
```

경로는 코드를 만들 때 조정할 수 있다. 기능별 도메인 규칙은 화면과 Route Handler에 중복 작성하지 않는다.

## 보안 설계 기준

- 브라우저에는 Supabase 공개용 키만 둔다. 비밀 키와 관리자 권한 키는 서버 환경에만 둔다.
- 외부에 노출되는 모든 데이터 테이블은 RLS를 켜고, `anon`과 `authenticated`의 SQL 권한 및 행 정책을 각각 확인한다. 인증 여부만으로 프로젝트 접근을 허용하지 않는다. [Supabase RLS 문서](https://supabase.com/docs/guides/database/postgres/row-level-security)
- 지원서·사진·내부 평가 데이터는 프로젝트 소유자 또는 본인에게만 허용한다. 배우에게 반환하는 응답에서 내부 필드를 제외한다.
- 로그인 링크가 실제 시범 운영에서 안정적으로 도착하도록 발송 도메인·SMTP 설정과 재전송 제한을 확인한다. [Supabase SMTP 문서](https://supabase.com/docs/guides/auth/auth-smtp)
- Supabase SSR 패키지는 문서상 베타이므로 구현 시 고정 버전과 잠금 파일을 사용하고 인증 흐름을 브라우저에서 검증한다. [Supabase SSR 문서](https://supabase.com/docs/guides/auth/server-side)

## 다른 선택지와 비교

| 선택지 | 장점 | 이번 MVP의 부담 |
| --- | --- | --- |
| **권장: Next.js + Supabase** | 웹·API를 한 저장소에서 구현하고 관계형 데이터·인증·비공개 파일을 묶어 설계 가능 | RLS·이메일 발송 설정을 제대로 검증해야 함 |
| React/Vite + 별도 API + Postgres | 프런트·백엔드 경계가 명확하고 독립 배포 가능 | 초기 팀에 API 서버·배포·인증 연동 작업이 추가됨 |
| React/Vite + Firebase | 사용자에게 익숙한 개발 경험을 활용할 수 있음 | 지원서·조건·평가·후보의 관계, 복합 조회와 권한 정책을 별도로 세밀하게 설계해야 함 |

팀이 이미 다른 기술에 익숙하다면 그 경험도 결정 요소다. 위 비교는 제품 구조에 대한 설계 판단이며 성능·가격을 실측한 결과가 아니다.

## 승인 전 확인할 것

1. 팀이 Next.js·TypeScript·SQL을 실제로 유지보수할 수 있는가. iPhone·Android 실기기 검증을 누가 맡는가.
2. 이메일 링크 인증이 배우 지원 완료율을 떨어뜨리지 않는가. 첫 지원의 인증 시점을 별도 사용자 테스트로 확인한다.
3. 시범 운영의 예상 지원자·사진 용량과 이메일 발송량이 예산에 맞는가.
4. 지원서와 미디어 보관 기간·삭제 요청 처리 방식을 팀이 정했는가.

승인되면 [협업 문서](COLLABORATION.md)의 D01에 날짜·결정자·이유를 적고, 백로그의 파일 경로를 이 구조에 맞춰 확정한다.
