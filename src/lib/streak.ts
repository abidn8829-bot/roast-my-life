function toDateKey(iso: string): string {
  return new Date(iso).toISOString().split("T")[0]!;
}

function previousDay(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0]!;
}

/** Count consecutive days with at least one roast, ending today or yesterday. */
export function calculateStreak(createdAtDates: string[]): number {
  if (createdAtDates.length === 0) return 0;

  const dateSet = new Set(createdAtDates.map(toDateKey));
  const today = toDateKey(new Date().toISOString());
  const yesterday = previousDay(today);

  let cursor: string;
  if (dateSet.has(today)) {
    cursor = today;
  } else if (dateSet.has(yesterday)) {
    cursor = yesterday;
  } else {
    return 0;
  }

  let streak = 0;
  while (dateSet.has(cursor)) {
    streak++;
    cursor = previousDay(cursor);
  }

  return streak;
}
