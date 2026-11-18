import type {
  ActivitySessionResponseDto,
  ChronologicalActivitySession,
} from "@/lib/interfaces/activity-session";

export function orderActivitySessions(
  sessions: readonly ActivitySessionResponseDto[],
): ChronologicalActivitySession[] {
  const orderByActivity = new Map<string, number>();

  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date) || a.sessionNumber - b.sessionNumber)
    .map((session) => {
      const activityId = session.activity.id;
      const displayNumber = (orderByActivity.get(activityId) ?? 0) + 1;
      orderByActivity.set(activityId, displayNumber);
      return { ...session, displayNumber };
    });
}
