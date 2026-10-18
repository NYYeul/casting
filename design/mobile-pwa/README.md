# 모바일 PWA 주요 화면 방향 시안

**제품 기준:** [PRD 0.2](../../PRD.md) · [모바일 PWA 요구사항](../../docs/MOBILE_PWA_REQUIREMENTS.md)  
**상태:** 목록 중심 방향으로 첫 구현 완료, 팀 리뷰 대기

제작자가 휴대전화에서 지원자를 검토하고 오디션 후보·연락으로 넘어가는 흐름을 세 가지로 표현했다. 화면의 사람·작품·날짜·연락 상태는 설명용 가상 데이터이며, 실제 구현에서 [화면·채팅 명세](../../docs/UI_CHAT_SPEC.md)의 상태 규칙으로 다시 작성한다.

1. [지원자 목록 중심](01-applicant-list.png)
2. [배우 카드 중심](02-focused-actor-card.png)
3. [후보·오디션 연락 중심](03-shortlist-contact.png)

사용자의 `일단 구현해봐` 요청에 따라 1번 목록 중심 방향을 첫 버전에 적용했다. 390×844 브라우저 확인 화면:

- [지원자 검토 구현](05-implemented-applicants.png)
- [제작자 채팅·일정 구현](04-implemented-chat.png)
- [배우 지원 현황 구현](06-implemented-actor-status.png)

이전 [데스크톱 탐색 시안](../mockups/README.md)은 구현 기준이 아니다.
