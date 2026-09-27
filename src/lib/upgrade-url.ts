// Builds the "Upgrade to Pro" link. Goes straight to Gumroad checkout (wanted=true) with the
// buyer's email prefilled, so the Gumroad webhook can match the purchase to the account by email.
export const UPGRADE_EMAIL_HINT = "Use the same email you signed up with so Pro unlocks instantly.";

export function getUpgradeUrl(email?: string | null): string {
  const productUrl = process.env.NEXT_PUBLIC_GUMROAD_PRODUCT_URL;
  if (!productUrl) return "/pricing";

  try {
    const url = new URL(productUrl);
    url.searchParams.set("wanted", "true");
    const trimmed = email?.trim();
    if (trimmed) url.searchParams.set("email", trimmed);
    return url.toString();
  } catch {
    return productUrl;
  }
}
