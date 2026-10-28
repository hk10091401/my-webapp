// 처음 열었을 때의 기본 회사. "설정" 탭에서 전부 바꿀 수 있고,
// 바꾼 내용은 이 브라우저에 저장됩니다. 초기화하면 이 값으로 돌아옵니다.

import type { OfficeConfig } from "./types";

export const HAIR_COLORS = ["#2b2230", "#4a3226", "#6e4630", "#a8643c", "#d9a066", "#3b4a6b", "#7a3b52", "#e8e1d4"];
export const SHIRT_COLORS = ["#f2b33d", "#6fb7e8", "#8fd1a8", "#e86f8a", "#a58ee0", "#f4f1e8", "#3f7d73", "#f08a4b"];

export const DEFAULT_CONFIG: OfficeConfig = {
  officeName: "나의 오피스",
  logo: "◆",
  openAt: 540,
  closeAt: 1080,
  me: {
    name: "나",
    title: "대표 · 최종 결정",
    hair: "#2b2230",
    shirt: "#f2b33d",
  },
  assistantDeptId: "assistant",
  departments: [
    { id: "plan", name: "기획실", icon: "💡", routine: "이번 주 우선순위 정리", color: "#fff1c9", keywords: "기획,계획,아이디어,우선순위" },
    { id: "research", name: "리서치랩", icon: "🔎", routine: "업계 소식·경쟁사 훑어보기", color: "#dcefff", keywords: "리서치,조사,트렌드,경쟁사,뉴스" },
    { id: "design", name: "디자인 스튜디오", icon: "🎨", routine: "썸네일·배너 시안 3종", color: "#f6e1f0", keywords: "디자인,썸네일,배너,로고,시안" },
    { id: "content", name: "콘텐츠팀", icon: "✍️", routine: "다음 글·영상 원고 초안", color: "#e3f5e8", keywords: "콘텐츠,원고,글,영상,대본,블로그" },
    { id: "marketing", name: "마케팅팀", icon: "📣", routine: "SNS 예약 게시물 점검", color: "#ffe4d6", keywords: "마케팅,홍보,sns,광고,인스타" },
    { id: "dev", name: "개발팀", icon: "🛠️", routine: "웹사이트 오류·속도 점검", color: "#e6e6fb", keywords: "개발,웹사이트,버그,코드,자동화" },
    { id: "finance", name: "재무팀", icon: "🧾", routine: "이번 달 수입·지출 정리", color: "#efeedd", keywords: "재무,돈,정산,세금,입금,지출" },
    { id: "assistant", name: "비서실", icon: "📋", routine: "일정 정리·하루 브리핑 준비", color: "#dff3f1", keywords: "비서,일정,브리핑,메일,정리" },
  ],
  staff: [
    { id: "s1", deptId: "plan", rank: "lead", name: "윤하람", role: "기획실장", hair: "#4a3226", shirt: "#f2b33d", thoughts: ["이번 주에 꼭 끝낼 건 세 개뿐.", "급한 것과 중요한 건 다르죠."] },
    { id: "s2", deptId: "plan", rank: "member", name: "서지안", role: "프로젝트 매니저", hair: "#2b2230", shirt: "#8fd1a8", thoughts: ["마감일 역산해보는 중.", "회의는 15분 안에 끝내요."] },
    { id: "s3", deptId: "research", rank: "lead", name: "김도윤", role: "리서치 리드", hair: "#3b4a6b", shirt: "#6fb7e8", thoughts: ["출처 없는 숫자는 안 씁니다.", "원문 링크부터 확인."] },
    { id: "s4", deptId: "research", rank: "member", name: "이수아", role: "트렌드 분석", hair: "#a8643c", shirt: "#f4f1e8", thoughts: ["요즘 사람들은 뭘 저장할까.", "지난주랑 비교해볼게요."] },
    { id: "s5", deptId: "research", rank: "member", name: "박로운", role: "경쟁사 모니터링", hair: "#2b2230", shirt: "#a58ee0", thoughts: ["경쟁사가 새 상품 냈네.", "가격표 캡처해 둡니다."] },
    { id: "s6", deptId: "design", rank: "lead", name: "정나래", role: "아트 디렉터", hair: "#7a3b52", shirt: "#e86f8a", thoughts: ["여백이 더 필요해요.", "색은 세 개까지만."] },
    { id: "s7", deptId: "design", rank: "member", name: "한유찬", role: "그래픽 디자이너", hair: "#6e4630", shirt: "#f2b33d", thoughts: ["썸네일 글자 더 크게!", "시안 B가 제일 나은데."] },
    { id: "s8", deptId: "content", rank: "lead", name: "최다온", role: "에디터", hair: "#d9a066", shirt: "#3f7d73", thoughts: ["첫 문장이 전부예요.", "결론부터 쓰자."] },
    { id: "s9", deptId: "content", rank: "member", name: "오세린", role: "작가", hair: "#2b2230", shirt: "#f08a4b", thoughts: ["문단이 너무 길어.", "예시 하나 더 넣을까."] },
    { id: "s10", deptId: "content", rank: "member", name: "문이현", role: "영상 편집", hair: "#4a3226", shirt: "#6fb7e8", thoughts: ["컷이 늘어지면 이탈해요.", "자막 오타 체크 중."] },
    { id: "s11", deptId: "marketing", rank: "lead", name: "강태리", role: "마케팅 리드", hair: "#a8643c", shirt: "#e86f8a", thoughts: ["저장 수가 진짜 지표.", "올리는 시간도 전략이에요."] },
    { id: "s12", deptId: "marketing", rank: "member", name: "임주원", role: "SNS 운영", hair: "#3b4a6b", shirt: "#f4f1e8", thoughts: ["댓글에 답장 달아야지.", "해시태그는 다섯 개만."] },
    { id: "s13", deptId: "dev", rank: "lead", name: "배시우", role: "개발 리드", hair: "#2b2230", shirt: "#a58ee0", thoughts: ["일단 재현부터 해볼게요.", "배포는 금요일엔 안 해요."] },
    { id: "s14", deptId: "dev", rank: "member", name: "신하준", role: "자동화 담당", hair: "#e8e1d4", shirt: "#3f7d73", thoughts: ["이거 반복 작업이네. 자동화각.", "로그 남겨둘게요."] },
    { id: "s15", deptId: "finance", rank: "lead", name: "조은솔", role: "재무 매니저", hair: "#6e4630", shirt: "#f4f1e8", thoughts: ["영수증은 그날 정리.", "세금 신고일 체크했어요."] },
    { id: "s16", deptId: "finance", rank: "member", name: "황보민", role: "정산 담당", hair: "#4a3226", shirt: "#8fd1a8", thoughts: ["입금 대기 두 건.", "엑셀 함수 하나면 끝나요."] },
    { id: "s17", deptId: "assistant", rank: "lead", name: "류소담", role: "비서실장", hair: "#7a3b52", shirt: "#6fb7e8", thoughts: ["대표님이 결정할 것만 추려요.", "오늘 일정 세 개입니다."] },
    { id: "s18", deptId: "assistant", rank: "member", name: "남궁별", role: "일정 관리", hair: "#d9a066", shirt: "#f2b33d", thoughts: ["미팅 시간 겹치는지 확인.", "메일 답장 초안 써둘게요."] },
  ],
};
