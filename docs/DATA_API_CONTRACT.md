# 데이터와 API 계약 초안

**상태:** 구현 기술 선택 전 계약  
**대상:** [PRD](../PRD.md) R01~R10·R17의 프런트엔드·백엔드 협업

이 문서는 화면과 서버가 공유할 **의미·권한·오류**를 정한다. 아래 경로는 HTTP API를 선택할 경우의 제안이며, 다른 백엔드를 선택해도 같은 계약을 유지한다. 필드명 변경은 프런트엔드와 백엔드가 같은 PR에서 반영한다.

## 1. 공통 규칙

- ID는 외부에 노출해도 추측만으로 권한이 생기지 않는 불투명 문자열이다.
- 시각은 API에서 ISO 8601 시간대 포함 문자열로 주고받는다. UI는 한국 시간으로 표시한다.
- 금액은 숫자만 저장하지 않고 `amount`, `currency`, `negotiable`, `unpaid`를 구분한다. 무급과 미입력은 다르다.
- 필수 조건 판정은 `met | unmet | unknown` 세 값이다. 정보 누락은 `unknown`이다.
- 목록 API는 페이지 단위로 조회하며 정렬 필드와 커서를 명시한다.
- 입력 오류는 필드별 오류, 권한 오류는 일반 접근 오류, 마감·중복 같은 업무 충돌은 충돌 오류로 구분한다.
- 클라이언트에서 숨긴 필드라도 서버가 다시 권한을 검사한다.

### 오류 응답 형태

```json
{
  "error": {
    "code": "ROLE_CLOSED",
    "message": "지원이 마감된 배역입니다.",
    "fieldErrors": {}
  }
}
```

`fieldErrors`는 입력 오류에만 사용한다. 오류 코드는 UI 번역·재시도 판단에 사용하므로 변경 시 계약 변경으로 다룬다.

## 2. 핵심 데이터 객체

| 객체 | 주요 필드 | 관계·제약 |
| --- | --- | --- |
| `User` | `id`, `email`, `emailVerifiedAt`, `createdAt` | 이메일은 인증된 경우에만 본인 조회 기준으로 사용 |
| `Project` | `id`, `ownerUserId`, `title`, `productionType`, `createdAt` | MVP는 소유자 1명. 팀원 초대는 P1 |
| `Role` | `id`, `projectId`, `slug`, `title`, `description`, `shootStartsAt`, `shootEndsAt`, `location`, `compensation`, `transportMeal`, `usage`, `contactName`, `applicationDeadlineAt`, `resultExpectedAt`, `status` | `draft | published | closed`. 게시 시 필수 공고 정보 검증 |
| `RoleRequirement` | `id`, `roleId`, `key`, `label`, `required`, `answerType` | 제작자 입력 조건. 촬영일·이동·보수·필수 역량을 구조화 |
| `ActorProfile` | `id`, `userId`, `displayName`, `summary`, `experience`, `photoAssetIds`, `reuseConsentAt` | 프로필 재사용은 별도 동의가 있을 때만 |
| `Asset` | `id`, `ownerUserId`, `storagePath`, `mediaType`, `uploadStatus`, `createdAt` | 비공개 저장소 파일의 메타데이터. 저장 완료 전에는 지원서에 첨부하지 않음 |
| `Application` | `id`, `roleId`, `applicantUserId`, `profileSnapshot`, `actingVideoUrl`, `availabilityAnswer`, `participationIntent`, `submittedAt`, `internalReviewState`, `publicStatus` | 제출 당시 자료를 스냅샷으로 보관. 상태는 분리 |
| `ApplicationAnswer` | `applicationId`, `requirementId`, `value`, `fit` | `fit`은 `met | unmet | unknown`. 변경된 배역 조건과 이전 응답을 혼동하지 않음 |
| `Review` | `applicationId`, `reviewerUserId`, `note`, `updatedAt` | 내부 메모. 배우 응답에서 제외 |
| `ShortlistEntry` | `roleId`, `applicationId`, `addedAt`, `removedAt` | 한 배역의 동일 지원서는 활성 후보 목록에 1번만 포함 |
| `Notification` | `id`, `applicationId`, `kind`, `recipient`, `status`, `attemptCount`, `sentAt` | `queued | sent | failed`. 재시도와 중복 방지용 |
| `ProductEvent` | `id`, `actorUserId`, `anonymousSessionId`, `roleId`, `applicationId`, `name`, `occurredAt` | 분석용. 시작 시점의 익명 세션을 허용하되 사진·자유서술·영상 URL 제외 |

`ActorProfile`과 별도 인증 계정이 MVP에 꼭 필요한지는 첫 개발 회의에서 결정한다. 배우가 계정 없이 처음 제출하는 방식을 선택하면 `applicantUserId`는 인증 완료 시 연결되는 선택 필드로 바꾸고, 그 전에는 일회성 접근 토큰과 연락처 검증 흐름을 설계해야 한다. 임의의 이메일 문자열만으로 본인 지원서를 조회하게 해서는 안 된다.

## 3. 상태 값

| 필드 | 값 | 사용자에게 보이는 범위 |
| --- | --- | --- |
| `Role.status` | `draft`, `published`, `closed` | `published`만 공개 링크에서 지원 가능 |
| `Application.internalReviewState` | `new`, `reviewing`, `hold`, `pass`, `interested` | 제작자만 |
| `Application.publicStatus` | `received`, `audition_invited`, `cast`, `not_selected` | 본인 배우와 제작자 |
| `Notification.status` | `queued`, `sent`, `failed` | 제작자 운영 화면에 발송 상태 표시 |

내부 검토 상태를 바꾸는 요청은 `publicStatus`를 바꾸지 않는다. 공개 상태 변경은 별도 확정 API에서만 가능하다.

## 4. API 초안

| 메서드·경로 | 요청 주체 | 요청 요점 | 응답·효과 | PRD |
| --- | --- | --- | --- | --- |
| `POST /projects` | 인증 제작자 | 제목·제작 유형 | 프로젝트 생성 | R01 |
| `POST /projects/{projectId}/roles` | 프로젝트 소유자 | 배역 브리프·조건 | 초안 생성 | R01 |
| `PATCH /roles/{roleId}` | 프로젝트 소유자 | 허용된 배역 필드 | 변경 저장·이력 기록 | R01 |
| `POST /roles/{roleId}/publish` | 프로젝트 소유자 | 게시 확인 | 공개 슬러그·지원 URL | R02 |
| `POST /roles/{roleId}/close` | 프로젝트 소유자 | 마감 확인 | 신규 지원 차단 | R01, R02 |
| `GET /public/roles/{slug}` | 누구나 | 없음 | 공개 브리프·필수 제출 항목만 반환 | R02 |
| `POST /public/roles/{slug}/applications` | 인증 또는 검증된 배우 | 프로필 스냅샷·자료·조건 답변·중복 방지 키 | 지원서 ID, 접수 시각, 접수 상태 | R03 |
| `GET /me/applications` | 인증 배우 | 페이지·상태 | 본인 지원 내역과 공개 상태만 | R08, R09 |
| `GET /roles/{roleId}/applications` | 프로젝트 소유자 | 필터·정렬·커서 | 지원자 목록, 3값 조건 판정 | R04, R05 |
| `GET /applications/{applicationId}` | 해당 프로젝트 소유자 또는 본인 배우 | 없음 | 권한별로 다른 상세 필드 | R03, R09 |
| `PATCH /applications/{applicationId}/review` | 프로젝트 소유자 | 내부 상태·메모 | 내부 평가 저장, 배우 알림 없음 | R06 |
| `PUT /roles/{roleId}/shortlist/{applicationId}` | 프로젝트 소유자 | 포함 여부 | 후보 목록 갱신 | R07 |
| `GET /roles/{roleId}/shortlist` | 프로젝트 소유자 | 없음 | 후보와 필수 확인 상태 | R07 |
| `POST /applications/{applicationId}/public-status` | 프로젝트 소유자 | 공개 상태·확정 확인·중복 방지 키 | 상태 저장·알림 예약 | R08 |

### 지원서 제출 예시

```json
{
  "profile": {
    "displayName": "지원자 이름",
    "summary": "짧은 소개",
    "experience": "관련 출연 경력"
  },
  "photoAssetIds": ["asset_opaque_id"],
  "actingVideoUrl": "https://example.com/acting-reel",
  "availabilityAnswer": "available",
  "participationIntent": true,
  "answers": [
    { "requirementId": "req_opaque_id", "value": "가능" }
  ],
  "idempotencyKey": "client_generated_unique_value"
}
```

`actingVideoUrl`은 지원자가 직접 제공한 URL로 취급한다. 미리보기·외부 콘텐츠 접근은 URL 안전성 검사와 허용 정책을 정한 뒤 제공한다. 서버가 임의의 내부 네트워크 주소를 가져오지 않는다.

## 5. 권한·정보 공개 계약

1. 공개 배역 응답에는 지원자 수, 내부 메모, 이메일, 비공개 파일 URL을 포함하지 않는다.
2. 배우 본인 응답에는 내부 평가·후보 순위·다른 배우 자료를 포함하지 않는다.
3. 제작자 응답은 소유 프로젝트의 지원서만 포함한다. 다른 프로젝트 ID를 임의로 요청해도 조회되지 않는다.
4. 파일 접근에는 권한 검사가 필요하다. 공개 링크에서 직접 영구 파일 URL을 노출하지 않는다.
5. 로그와 분석 이벤트에는 배우의 프로필 본문, 연락처, 사진, 영상 링크를 넣지 않는다.

## 6. 확정 전 계약 쟁점

| 쟁점 | 선택이 API에 미치는 영향 | 결정 위치 |
| --- | --- | --- |
| 배우 첫 지원의 인증 | 공개 제출 API와 본인 조회·수정 방식 | [협업 문서](COLLABORATION.md) D02 |
| 사진·영상 처리 | 파일 업로드 API, 용량 제한, 저장 비용 | D03 |
| 중복 지원·수정 | 유니크 제약, `POST`·`PATCH` 동작 | D04 |
| 결과 안내 채널 | 이메일 발송과 실패 재시도 방식 | D05 |
| 데이터 보관·삭제 | 파일·지원서 삭제 API와 운영 정책 | D06 |
