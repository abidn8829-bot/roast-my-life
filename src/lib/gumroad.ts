// Pure helpers for the Gumroad webhook (src/app/api/webhook/gumroad/route.ts).

export type GumroadAction = "upgrade" | "downgrade" | "ignore";

// What a Gumroad ping means for the buyer's tier. The plain Ping URL only sends
// sales (no resource_name); the rest arrive via resource_subscriptions.
// "cancellation" is ignored on purpose: the buyer keeps Pro until the paid
// period runs out, which Gumroad reports separately as "subscription_ended".
export function gumroadAction(data: Record<string, string>): GumroadAction {
  switch (data.resource_name ?? "sale") {
    case "sale":
      return data.refunded === "true" || data.disputed === "true" ? "downgrade" : "upgrade";
    case "subscription_restarted":
    case "dispute_won":
      return "upgrade";
    case "refund":
    case "dispute":
    case "subscription_ended":
      return "downgrade";
    default:
      return "ignore";
  }
}

// Sales and refunds carry `email`; subscription events carry `user_email`.
export function gumroadBuyerEmail(data: Record<string, string>): string | undefined {
  const email = (data.email || data.user_email || "").trim();
  return email || undefined;
}

// Escape LIKE wildcards so `.ilike()` becomes an exact, case-insensitive match.
// Unescaped, a buyer email like "j_hn@x.com" would also match "john@x.com".
// PostgREST also treats `*` as `%`; escaping it makes an email containing `*`
// match nothing rather than many rows (fails closed).
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_*]/g, (c) => `\\${c}`);
}
