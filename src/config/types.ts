// 회사 설정의 모양. 화면의 "설정" 탭에서 고친 값도 이 모양 그대로 저장됩니다.

export type Rank = "lead" | "member";

export type Department = {
  /** 내부 식별자. 설정 화면에서 만들면 자동으로 붙습니다. */
  id: string;
  name: string;
  icon: string;
  /** 매일 아침 이 팀이 스스로 시작하는 기본 업무 */
  routine: string;
  /** 방 바닥에 깔리는 팀 색 */
  color: string;
  /** 지시창에서 이 팀을 알아듣는 단어 (쉼표로 구분) */
  keywords: string;
};

export type Staff = {
  id: string;
  deptId: string;
  rank: Rank;
  name: string;
  role: string;
  hair: string;
  shirt: string;
  /** 자리를 비우거나 쉬는 동안 머리 위에 뜨는 혼잣말 */
  thoughts: string[];
};

export type Me = {
  name: string;
  title: string;
  hair: string;
  shirt: string;
};

export type OfficeConfig = {
  officeName: string;
  /** 헤더 로고 칸에 들어가는 한 글자 (이모지 가능) */
  logo: string;
  /** 출근 시각 (분 단위, 9시 = 540) */
  openAt: number;
  /** 퇴근 시각 (분 단위, 18시 = 1080) */
  closeAt: number;
  me: Me;
  /** 현황 보고와 하루 브리핑을 맡는 팀 */
  assistantDeptId: string;
  departments: Department[];
  staff: Staff[];
};
