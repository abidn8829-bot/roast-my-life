// Short-lived handoff for achievement unlocks: the roast/check-in API routes set this
// right after unlocking, and the dashboard page reads it on the next load. Needed because
// unlockAchievements() only reports an id as "newly unlocked" once — by the time a user
// navigates to /dashboard after finishing a roast, that flag has already been consumed by
// the API route that redirected them there.
export const PENDING_ACHIEVEMENT_COOKIE = "pending_achievement_unlocks";

export function encodePendingAchievements(ids: string[]): string {
  return encodeURIComponent(JSON.stringify(ids));
}

export function decodePendingAchievements(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
