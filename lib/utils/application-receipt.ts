const SUBMITTED_RECRUITMENT_KEY = "cnu_submitted_recruitment";

export function rememberApplicationSubmission(recruitmentId: string): boolean {
  try {
    window.sessionStorage.setItem(SUBMITTED_RECRUITMENT_KEY, recruitmentId);
    return true;
  } catch {
    return false;
  }
}

export function hasApplicationSubmission(recruitmentId: string): boolean {
  try {
    return window.sessionStorage.getItem(SUBMITTED_RECRUITMENT_KEY) === recruitmentId;
  } catch {
    return false;
  }
}
