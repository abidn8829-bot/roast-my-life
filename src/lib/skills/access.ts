// Which months of a skill a user can open. A PURE function: no database, no clock, no I/O.
// (No "@/" imports on purpose: src/lib/skills/*.test.ts import this with Node.)
//
// The rule:
//   Free users   month 1 is open, months 2 to 6 are locked.
//   Pro users    every month is open.
// The tier is the plan the user has RIGHT NOW. A Pro user whose plan ended is "free" here, so months 2 to 6 lock
// again straight away. Nothing they learned is lost: it is only hidden until they are back on Pro.

import type { MonthAccess, Tier } from "./types.ts";

/** How many months a free user can open (month 1 only). */
export const FREE_MONTH_COUNT = 1;

/** True when `month` (1-based) is one of the free months. Anything that is not a whole number from 1 up is not free. */
export function isFreeMonth(month: number): boolean {
  return Number.isInteger(month) && month >= 1 && month <= FREE_MONTH_COUNT;
}

/** "open" or "locked". Anything that is not clearly "pro" is treated as free, so a bad value never opens a month. */
export function canOpenMonth({ monthIsFree, tier }: { monthIsFree: boolean; tier: Tier }): MonthAccess {
  if (tier === "pro") return "open";
  return monthIsFree === true ? "open" : "locked";
}
