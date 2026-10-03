# 직원 초대 활성화

계정 승인 마이그레이션 202610030016을 먼저 적용한다.

Vercel Production 환경변수:
- APP_SITE_URL: https://pcb-pack-system.vercel.app
- SUPABASE_SERVICE_ROLE_KEY: Supabase의 서버 전용 service_role 키. NEXT_PUBLIC_ 접두사를 붙이지 않으며 소스나 채팅에 공유하지 않는다.

변수 등록 후 재배포한다. 초대 API는 설정 누락 시 발송하지 않는다.

Supabase Authentication URL Configuration의 허용 redirect URL에 https://pcb-pack-system.vercel.app/auth/update-password 를 등록한다. Invite user 이메일 템플릿의 링크는 다음 형식으로 설정한다:

https://pcb-pack-system.vercel.app/auth/confirm?token_hash={{ .TokenHash }}&type=invite

이 링크는 서버 OTP 검증 후 비밀번호 설정 화면으로 이동한다. 실제 직원 주소로 테스트하기 전에 승인된 테스트 주소로 발송·비밀번호 설정·승인 대기 접근 차단·최고관리자 활성화·로그인을 확인한다. 발송 서비스의 SMTP 설정과 발송 한도도 확인한다.

서브 관리자는 /staff-invitations에서 이름과 이메일만 입력한다. 임의 역할이나 활성 상태를 전달해도 API는 적용하지 않는다. 승인된 최고관리자가 설정 화면에서 활성화 및 서브 관리자 지정을 수행한다.

직원 초대 이메일 발송 성공과 이력 저장 성공은 별도이며, 이력 실패 시 화면에서 명시한다. 아직 외부 이메일 발송 시험은 수행하지 않았다. 공개 가입 경로 차단 및 메일 재초대·속도 제한은 후속 작업이다.
