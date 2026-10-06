export interface HomeFaqItem {
  id: string;
  question: string;
  answer: string;
}

export const HOME_FAQ_ITEMS: HomeFaqItem[] = [
  {
    id: "activities",
    question: "CNU에서는 어떤 활동을 하나요?",
    answer:
      "웹 개발과 소프트웨어 시스템을 중심으로 강의, 스터디, 프로젝트를 진행합니다. 함께 배우고 직접 만들어보는 활동뿐 아니라 멘토링과 네트워킹을 통해 경험을 나누고 있습니다.",
  },
  {
    id: "experience",
    question: "개발 경험이 많지 않아도 함께할 수 있나요?",
    answer:
      "개발 경험이 많지 않더라도 관심 있는 분야를 함께 배워갈 수 있습니다. 활동마다 다루는 주제와 필요한 사전 지식이 다르니, 활동 소개를 확인하고 자신에게 맞는 강의나 스터디를 찾아보세요.",
  },
  {
    id: "recruitment",
    question: "학회원 모집은 어디서 확인하나요?",
    answer:
      "모집 일정과 지원 방법은 홈 화면의 지원 안내와 학회 소식을 통해 확인할 수 있습니다. 모집 기간에는 지원 안내에서 공고를 확인하고 지원서를 작성할 수 있습니다.",
  },
  {
    id: "schedule",
    question: "활동 일정은 어떻게 정해지나요?",
    answer:
      "활동 일정은 강의, 스터디, 프로젝트마다 다르게 운영됩니다. 관심 있는 활동의 안내에서 진행 기간과 일정을 확인하고, 자세한 내용은 해당 활동 담당자에게 문의해주세요.",
  },
  {
    id: "room",
    question: "학회실은 어디에 있나요?",
    answer:
      "CNU 학회실은 서강대학교 리치과학관(R관) 9층, R912에 있습니다. 아래 위치 안내에서 지도를 확인할 수 있으며, 방문이나 이용 관련 문의는 admin@cnu.team으로 보내주세요.",
  },
];
