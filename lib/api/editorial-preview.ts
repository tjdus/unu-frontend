import { getBlogPosts } from "@/lib/api/blog";
import { getPortfolios } from "@/lib/api/portfolio";
import type { BlogCategory, BlogPost } from "@/lib/interfaces/blog";
import type { PortfolioResponse } from "@/lib/interfaces/portfolio";

const previewEnabled = process.env.NODE_ENV === "development";

// Keep preview content out of the shared API cache and write paths.
const previewProjects: PortfolioResponse[] = [
  { id: "preview-campus-guide", title: "캠퍼스 가이드", description: "처음 방문하는 사람도 강의실과 편의시설을 쉽게 찾을 수 있는 캠퍼스 지도입니다.", pinned: true },
  { id: "preview-study-board", title: "스터디 보드", description: "팀별 학습 일정과 주간 목표를 한눈에 확인하는 협업 도구입니다.", pinned: false },
  { id: "preview-bookcase", title: "공유 책장", description: "학회원이 읽고 있는 책을 기록하고 서로에게 추천할 수 있는 서비스입니다.", pinned: false },
  { id: "preview-project-log", title: "프로젝트 로그", description: "기획부터 배포까지의 결정과 실험을 시간순으로 정리하는 기록 도구입니다.", pinned: false },
  { id: "preview-campus-calendar", title: "캠퍼스 캘린더", description: "흩어진 교내 행사와 신청 마감일을 한 화면에 모은 캘린더입니다.", pinned: false },
].map((project, index) => ({
  ...project,
  description: `${project.description}\n\n## 진행 과정\n\n사용 흐름을 먼저 그려본 뒤, 작은 기능 단위로 나누어 구현하고 테스트했습니다.`,
  thumbnailUrl: project.pinned ? "/map.png" : "",
  startQuarterId: "preview-quarter-1",
  startQuarterName: "25-2",
  endQuarterId: "preview-quarter-2",
  endQuarterName: "26-1",
  contributors: [
    { id: "preview-member-1", userId: null, name: "샘플 참여자 A", role: "Frontend" },
    { id: "preview-member-2", userId: null, name: "샘플 참여자 B", role: "Backend" },
  ],
  createdAt: `2026-07-${22 - index}T09:00:00+09:00`,
  createdBy: "preview-author",
}));

const postTopics: { slug: string; title: string; subtitle: string; category: BlogCategory }[] = [
  { slug: "smooth-navigation", title: "페이지 전환을 부드럽게 만드는 법", subtitle: "화면이 흔들리는 원인을 찾아 레이아웃을 정리한 과정", category: "tech" },
  { slug: "first-deploy", title: "첫 배포를 하고 배운 것들", subtitle: "작은 프로젝트를 공개하고 나서 달라진 관점", category: "essay" },
  { slug: "accessible-components", title: "키보드로도 쓰기 좋은 컴포넌트", subtitle: "포커스와 탭 순서부터 점검하기", category: "tech" },
  { slug: "working-together", title: "함께 개발한다는 것", subtitle: "팀 프로젝트에서 합의한 작은 규칙들", category: "essay" },
  { slug: "api-cache", title: "목록 조회 캐시를 설계하기", subtitle: "같은 요청을 반복하지 않으면서 최신 정보를 유지하는 방법", category: "tech" },
  { slug: "study-notes", title: "스터디를 기록으로 남기기", subtitle: "회의록보다 잘 남는 세 가지 질문", category: "essay" },
];

const previewPosts: BlogPost[] = postTopics.map(({ slug, title, subtitle, category }, index) => ({
  id: `preview-${slug}`,
  title,
  subtitle,
  category,
  description: `${subtitle}을 주제로 작성한 샘플 글입니다.\n\n## 처음에 확인한 것\n\n어떤 부분에서 문제가 생기는지 관찰하고, 확인해야 할 항목을 정리했습니다.\n\n- 가장 자주 쓰이는 동작부터 확인하기\n- 작은 화면과 키보드 조작도 함께 확인하기\n\n> 작은 변경을 먼저 검증하면 다음 결정을 내리기 쉬워집니다.`,
  thumbnailUrl: "",
  createdBy: { id: "preview-author", name: "CNU 샘플", username: "preview", studentId: "" },
  createdAt: `2026-07-${22 - index}T09:00:00+09:00`,
}));

export function getPreviewProjects() {
  return previewEnabled ? previewProjects : [];
}

export function getPreviewPosts(category?: BlogCategory) {
  return previewEnabled
    ? previewPosts.filter((post) => !category || post.category === category)
    : [];
}

export function orderWorkList(projects: PortfolioResponse[]) {
  return [...projects].sort((a, b) => Number(b.pinned) - Number(a.pinned));
}

export async function readWorkList() {
  try {
    const { portfolios } = await getPortfolios();
    return portfolios.length ? portfolios : getPreviewProjects();
  } catch (error) {
    if (!previewEnabled) throw error;
    return getPreviewProjects();
  }
}

export async function readBlogList(category?: BlogCategory) {
  try {
    const { posts } = await getBlogPosts(category);
    if (posts.length || !previewEnabled) return posts;
    if (category && (await getBlogPosts()).posts.length) return posts;
    return getPreviewPosts(category);
  } catch (error) {
    if (!previewEnabled) throw error;
    if (category && await getBlogPosts().then(({ posts }) => posts.length > 0).catch(() => false)) {
      throw error;
    }
    return getPreviewPosts(category);
  }
}
