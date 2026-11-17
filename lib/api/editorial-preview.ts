import { getBlogPosts } from "@/lib/api/blog";
import { getPortfolios } from "@/lib/api/portfolio";
import type { BlogCategory, BlogPost } from "@/lib/interfaces/blog";
import type { PortfolioResponse } from "@/lib/interfaces/portfolio";

const previewEnabled = process.env.NODE_ENV === "development";

// Keep preview content out of the shared API cache and write paths.
const previewProjects: PortfolioResponse[] = [
  { id: "preview-wavehome", title: "WaveHome", description: "파도처럼 움직이는 인터랙션으로 학회를 소개하는 홈페이지입니다.", pinned: true },
  { id: "preview-cpp-juce", title: "C++와 JUCE", description: "C++와 JUCE 프레임워크로 직접 만든 오디오 플러그인 프로젝트입니다.", pinned: false },
  { id: "preview-alumni-meetup", title: "CNU 선배와의 만남", description: "현업에 있는 CNU 선배들을 초대해 진로와 경험을 나눈 네트워킹 행사입니다.", pinned: false },
].map((project, index) => ({
  ...project,
  description: `${project.description}\n\n## 진행 과정\n\n사용 흐름을 먼저 그려본 뒤, 작은 기능 단위로 나누어 구현하고 테스트했습니다.`,
  thumbnailUrl: "",
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
    // Development: sample projects follow the real ones, so generated thumbnails can be reviewed.
    return [...portfolios, ...getPreviewProjects()];
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
