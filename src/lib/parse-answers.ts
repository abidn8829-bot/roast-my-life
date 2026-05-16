import type { OnboardingAnswers } from "@/lib/roast-types";

function asObject(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Record<string, unknown>;
  return null;
}

export function parseAnswers(raw: unknown): OnboardingAnswers | null {
  const o = asObject(raw);
  if (!o) return null;

  const phoneHours = Number(o.phoneHours ?? o.phone_hours);
  const sleepHours = Number(o.sleepHours ?? o.sleep_hours);
  const foodDeliverySpend = Number(
    o.foodDeliverySpend ?? o.food_delivery_spend,
  );
  const worstApp =
    typeof o.worstApp === "string"
      ? o.worstApp
      : typeof o.worst_app === "string"
        ? o.worst_app
        : "";
  const neverDoThing =
    typeof o.neverDoThing === "string"
      ? o.neverDoThing
      : typeof o.never_do_thing === "string"
        ? o.never_do_thing
        : "";

  if (
    !Number.isFinite(phoneHours) ||
    !Number.isFinite(sleepHours) ||
    !Number.isFinite(foodDeliverySpend) ||
    !worstApp ||
    !neverDoThing
  ) {
    return null;
  }

  return {
    phoneHours,
    worstApp,
    sleepHours,
    foodDeliverySpend,
    neverDoThing,
  };
}
