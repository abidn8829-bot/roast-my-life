export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://roastmylife.vercel.app";

export function roastShareUrl(shareSlug: string): string {
  return `${SITE_URL}/roast/${shareSlug}`;
}
