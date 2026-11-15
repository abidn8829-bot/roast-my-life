import { focusRing, primaryButton } from "@/components/journal-auth-ui";

/**
 * Shared class strings for the landing sections. Text colours are only text-text (ink)
 * and text-text-muted, on the page background or surface. Sage, powder, butter and clay
 * are never used as text colours.
 */

export { focusRing };

// 96 px between sections on phone, 140 px from lg (desktop). scroll-mt keeps #anchors clear of the top.
export const section = "mt-24 scroll-mt-24 lg:mt-[140px]";

// Small label above a heading: Sora 400, 14 px.
export const label = "text-sm font-normal text-text-muted";

export const h2 = "font-display text-[34px] font-medium leading-[1.1] lg:text-[52px] lg:leading-[1.05]";

export const h3 = "font-display text-[26px] font-medium leading-[1.15] lg:text-[30px]";

// Body: Sora 400, 17 px phone / 18 px desktop, line height 1.6.
export const body = "text-[17px] font-normal leading-[1.6] lg:text-lg";

// Note under a button: Sora 400, 13 px.
export const note = "text-[13px] font-normal text-text-muted";

// Primary button: ink fill, #DCE6EE label, 56 px tall, full width on phone, auto width from sm.
export const ctaButton = `${primaryButton} sm:w-auto sm:px-11`;
