// Which "learn a skill" pages exist yet. A link to a page that does not exist must not be drawn, so the views read
// these flags. Flip a flag to true in the SAME change that adds the page (pages-ready.test.ts checks that the page
// file exists for every flag that is true).
// (No "@/" imports on purpose: the tests in this folder load this file directly with Node.)

export const SKILLS_PAGES = {
  /** /skills/session: today's session (learn, do, prove). */
  session: false,
  /** /skills/review: the due reviews. */
  review: false,
  /** /skills/notebook: the user's notes. */
  notebook: false,
} as const;

export const SKILLS_PAGE_PATHS = {
  session: "/skills/session",
  review: "/skills/review",
  notebook: "/skills/notebook",
} as const;
