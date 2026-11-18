// Run with: node --test src/lib/skills-pages.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins how the "learn a skill" PAGES (src/app/skills/**) and their components are built, by reading the source (the same
// approach as skills-wiring.test.ts, which does the same for the API routes). No network, no database, no rendering.
// What this protects: every page answers a 404 while the switch is off, before it reads the login, the plan, the URL
// parameters or any data; the plan is read on the server only; a locked month shows only its number, title and teaser;
// no answer field ever reaches a page; the journal look rules hold for every new file; a link to a page that does not
// exist yet is never drawn; and nothing public (landing, pricing, plans.ts, dashboard) mentions the feature.

import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { SKILLS_PAGES, SKILLS_PAGE_PATHS } from "./skills/pages-ready.ts";

const SRC = fileURLToPath(new URL("../", import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");
const rel = (p: string) => relative(SRC, p).replaceAll("\\", "/");

/** Removes block comments and `//` line comments (a `//` right after a colon, as in https://, is left alone). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const PAGES_DIR = join(SRC, "app/skills");
const appFiles = walk(PAGES_DIR).sort();
const pageFiles = appFiles.filter((f) => /[\\/]page\.tsx$/.test(f));
const COMPONENT_DIR = join(SRC, "components");
const componentFiles = readdirSync(COMPONENT_DIR)
  .filter((f) => /^(skills?-.*|journal-skill-art)\.tsx$/.test(f))
  .map((f) => join(COMPONENT_DIR, f))
  .sort();
const LIB_DIR = join(SRC, "lib/skills");
const newLibFiles = ["handout-blocks.ts", "home-state.ts", "pages-ready.ts", "quiz-state.ts"].map((f) => join(LIB_DIR, f));
const ALL_NEW = [...appFiles, ...componentFiles, ...newLibFiles];
const code = (f: string) => stripComments(read(f));

// ---------------------------------------------------------------------------
// which pages exist
// ---------------------------------------------------------------------------

test("pages: exactly the home, the pack map and the weekly handout exist (no session, review, test, notebook page yet)", () => {
  assert.deepEqual(pageFiles.map(rel), ["app/skills/[pack]/page.tsx", "app/skills/page.tsx", "app/skills/week/[n]/handout/page.tsx"]);
  assert.deepEqual(componentFiles.map((f) => f.split(/[\\/]/).pop()), [
    "journal-skill-art.tsx",
    "skill-quiz.tsx",
    "skill-upgrade-panel.tsx",
    "skills-handout-view.tsx",
    "skills-home-view.tsx",
    "skills-pack-map-view.tsx",
    "skills-shell.tsx",
    "skills-track.tsx",
  ]);
});

// ---------------------------------------------------------------------------
// the switch comes first
// ---------------------------------------------------------------------------

/** The body of the default exported page function. */
function pageBody(source: string): string {
  const start = source.search(/export default async function \w+\([^)]*\)\s*\{\n/);
  assert.notEqual(start, -1, "default async page function");
  return source.slice(start);
}

test("pages: every page calls skillsEnabled() and notFound() as its very first statement, before anything else", () => {
  for (const f of pageFiles) {
    const src = code(f);
    assert.match(src, /import \{ skillsEnabled \} from "@\/lib\/skills\/enabled";/, rel(f));
    assert.match(src, /import \{ notFound \} from "next\/navigation";/, rel(f));
    const body = pageBody(src);
    const first = body.match(/\)\s*\{\n\s*([^\n]+)/)![1]!.trim();
    assert.equal(first, "if (!skillsEnabled()) notFound();", `${rel(f)}: first statement`);
  }
});

test("pages: the switch is checked before the URL is read, the login, the plan, the database and every data call", () => {
  const afterwards = [
    "await params",
    "loadViewer(",
    "createSupabaseServerClient",
    "createSupabaseServiceClient",
    "getHome(",
    "getPackMap(",
    "getHandout(",
    "redirect(",
    "readTier(",
    "decodeURIComponent(",
  ];
  for (const f of pageFiles) {
    const body = pageBody(code(f));
    const guard = body.indexOf("skillsEnabled()");
    assert.ok(guard > -1, rel(f));
    for (const needle of afterwards) {
      const i = body.indexOf(needle);
      if (i !== -1) assert.ok(guard < i, `${rel(f)}: skillsEnabled() must come before ${needle}`);
    }
    // and no data call at all is made above the guard, anywhere in the file (module level)
    const head = code(f).slice(0, code(f).indexOf("export default async function"));
    assert.doesNotMatch(head, /\b(loadViewer|getHome|getPackMap|getHandout|readTier|createSupabase\w+)\(/, `${rel(f)}: no data call at module level`);
  }
});

test("pages: every page loads its data AFTER the switch and hands plain props to a presentational view", () => {
  const views: Record<string, [string, RegExp]> = {
    "app/skills/page.tsx": ["SkillsHomeView", /getHome\(viewer\.service, viewer\.userId, viewer\.tier\)/],
    "app/skills/[pack]/page.tsx": ["SkillsPackMapView", /getPackMap\(viewer\.service, viewer\.tier, \{ packId \}\)/],
    "app/skills/week/[n]/handout/page.tsx": ["SkillsHandoutView", /getHandout\(viewer\.service, viewer\.tier, weekNo\)/],
  };
  for (const f of pageFiles) {
    const [view, call] = views[rel(f)]!;
    const src = code(f);
    assert.match(src, new RegExp(`<${view}\\s+kind="ok"`), rel(f));
    assert.match(src, new RegExp(`<${view} kind="error" />`), `${rel(f)}: an error shows the friendly error view`);
    assert.match(src, call, rel(f));
    assert.doesNotMatch(src, /\.from\(|\.select\(/, `${rel(f)}: a page never queries tables itself`);
  }
});

// ---------------------------------------------------------------------------
// the login and the plan
// ---------------------------------------------------------------------------

test("viewer: login first (a visitor with no session goes to /login), then the plan from the server, then the service client", () => {
  const src = code(join(PAGES_DIR, "viewer.ts"));
  const client = src.indexOf("createSupabaseServerClient()");
  const user = src.indexOf("auth.getUser()");
  const redirectAt = src.indexOf("if (!user) redirect(");
  const tier = src.indexOf("await readTier(supabase, user.id)");
  const service = src.indexOf("openService(createSupabaseServiceClient)");
  assert.ok(client > -1 && client < user && user < redirectAt && redirectAt < tier && tier < service, "order: client, getUser, login redirect, readTier, service client");
  assert.match(src, /import \{ openService, readTier \} from "@\/lib\/skills\/route-helpers";/, "the same plan reader the API routes use");
  assert.doesNotMatch(src, /subscription_tier|\.from\(/, "the plan is read only through readTier");
  assert.doesNotMatch(src, /searchParams|headers\(|cookies\(/, "nothing is taken from the request");
});

test("pages: the plan is never taken from the URL, the query, a cookie or the browser, and only the pages use the viewer", () => {
  for (const f of pageFiles) {
    const src = code(f);
    assert.doesNotMatch(src, /searchParams|headers\(|cookies\(|["'`]tier["'`]\s*[:\]]|\.tier\s*=|\btier\s*=\s*(?!viewer|\{viewer\.tier\})/, rel(f));
    assert.match(src, /import \{ loadViewer \} from "(\.\.\/)*\.?\.?\/?viewer";/, rel(f));
  }
  for (const f of [...componentFiles, ...newLibFiles]) assert.doesNotMatch(code(f), /\bloadViewer\b|from "[./]*viewer"/, rel(f));
});

const FORBIDDEN_MODULE = /(?:^|\/)(?:grades|daily-limit|streak|achievements|achievement-push|changed-scores|parse-category-scores|percentile|arc-[\w-]+|missions(?:-server)?|check-in|roast|roast-[\w-]+|gumroad|plans|safety[\w-]*)(?:\.ts)?$/;
const importsOf = (source: string) => [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]!);

test("pages and components: nothing is imported from scoring, check-in, streak, the daily limit, safety, Gumroad or plans.ts", () => {
  for (const f of [...appFiles, ...componentFiles, ...newLibFiles]) {
    for (const spec of importsOf(code(f))) {
      assert.doesNotMatch(spec, FORBIDDEN_MODULE, `${rel(f)} imports ${spec}`);
    }
  }
  const allowedApp = new Set([
    "next",
    "next/navigation",
    "@supabase/supabase-js",
    "@/components/skills-home-view",
    "@/components/skills-pack-map-view",
    "@/components/skills-handout-view",
    "@/lib/skills/enabled",
    "@/lib/skills/skills-server",
    "@/lib/skills/route-helpers",
    "@/lib/skills/types",
    "@/lib/supabase/server",
    "@/lib/supabase/service",
    "./viewer",
    "../viewer",
    "../../../viewer",
  ]);
  for (const f of appFiles) for (const spec of importsOf(code(f))) assert.ok(allowedApp.has(spec), `${rel(f)} imports ${spec}, which is not on the approved list`);
});

// ---------------------------------------------------------------------------
// locked months and answers
// ---------------------------------------------------------------------------

test("locked months: the pack map and the handout draw a locked month ONLY as the upgrade panel with month, title, teaser", () => {
  const map = code(join(COMPONENT_DIR, "skills-pack-map-view.tsx"));
  const lockedBranch = map.match(/m\.locked \? \(\s*(<SkillUpgradePanel[^>]*\/>)/);
  assert.ok(lockedBranch, "the locked branch is just the panel");
  assert.match(lockedBranch![1]!, /month=\{m\.month\} title=\{m\.title\} teaser=\{m\.teaser\} source="map"/);
  assert.doesNotMatch(lockedBranch![1]!, /weeks|week|step|handout/i);
  const handout = code(join(COMPONENT_DIR, "skills-handout-view.tsx"));
  assert.match(handout, /<SkillUpgradePanel month=\{props\.locked\.month\} teaser=\{props\.locked\.teaser\} source="handout"/);
  const panel = code(join(COMPONENT_DIR, "skill-upgrade-panel.tsx"));
  assert.match(panel, /Month \{month\} is part of Pro/);
  assert.match(panel, /Pick up where you left off/);
  assert.match(panel, /getUpgradeUrl\(email\)/);
  assert.match(panel, /\{UPGRADE_EMAIL_HINT\}/);
  const panelWithoutSourceType = panel.replace(/source: "map" \| "handout" \| "step" \| "home";/, "");
  assert.doesNotMatch(panelWithoutSourceType, /weeks|handout|step/i, "the panel knows nothing but the month, title and teaser");
});

test("answers: no page, view, component or new library file names an answer, a correct index or a step's question text", () => {
  const field = /prove_correct|prove_explanation|prove_options|prove_question|correctIndex|\bcorrect_index\b|learn_body|do_prompt/;
  for (const f of ALL_NEW) assert.doesNotMatch(code(f), field, rel(f));
  // the quiz component only DRAWS what its parent hands in; it has no data and no route of its own
  const quiz = code(join(COMPONENT_DIR, "skill-quiz.tsx"));
  assert.match(quiz, /^"use client";/, "a client component, so its buttons can take onClick from a client parent");
  assert.doesNotMatch(quiz, /useState|useEffect|useRef|fetch\(|\/api\/|supabase|skills-server|route-helpers|track/i);
  assert.match(quiz, /onSelect\?\.\(index\)/);
  assert.match(quiz, /usableOptions\(options\)/);
});

test("the upgrade panel and the quiz pass the pure-component rules: props in, callbacks out", () => {
  const quiz = code(join(COMPONENT_DIR, "skill-quiz.tsx"));
  for (const prop of ["question", "options", "selectedIndex", "outcome", "disabled", "hint", "hintOpen", "explanation", "onSelect", "onToggleHint"]) {
    assert.match(quiz, new RegExp(`\\b${prop}\\b`), prop);
  }
});

// ---------------------------------------------------------------------------
// the look
// ---------------------------------------------------------------------------

test("look rules: no gradients, blur, glow shadows, emoji, or sage/powder/butter/clay used as a text colour, in every new file", () => {
  assert.equal(ALL_NEW.length, 16, `expected 16 new files, found ${ALL_NEW.length}`);
  for (const f of ALL_NEW) {
    const raw = read(f);
    const src = stripComments(raw);
    assert.doesNotMatch(src, /gradient/i, `${rel(f)}: gradient`);
    assert.doesNotMatch(src, /\bbg-(linear|radial|conic)-/, `${rel(f)}: gradient class`);
    assert.doesNotMatch(src, /(^|[\s"'`:])(from|via|to)-(\[|[a-z]+(-\d{2,3})?(\/\d+)?[\s"'`])/m, `${rel(f)}: gradient stop class`);
    assert.doesNotMatch(src, /backdrop-blur|backdrop-filter|\bblur-|filter:\s*blur/, `${rel(f)}: blur`);
    assert.doesNotMatch(src, /glow|drop-shadow|shadow-ember|shadow-\[[^\]]*(rgba|#|var)/i, `${rel(f)}: glow / coloured shadow`);
    assert.doesNotMatch(raw, /\p{Extended_Pictographic}|\p{Regional_Indicator}|‍|️/u, `${rel(f)}: emoji`);
    assert.doesNotMatch(src, /\btext-(sage|powder|butter|clay|milestone|progress)\b/, `${rel(f)}: a fill colour used as text`);
    assert.doesNotMatch(src, /\b(fill|stroke|color)=["'](?:#|rgb|hsl)/, `${rel(f)}: colours come from the theme tokens`);
    assert.doesNotMatch(src, /\bborder-(?:2|4|8)\b[^"`]*\bshadow-\[\d+px_\d+px/, `${rel(f)}: neo-brutalist offset shadow`);
    assert.doesNotMatch(src, /\bshadow-\[\d+px_\d+px_0/, `${rel(f)}: hard offset shadow`);
  }
});

test("look rules: icons are hand-drawn inline SVG with aria-hidden, in ink, and the art file has no images or packages", () => {
  const art = code(join(COMPONENT_DIR, "journal-skill-art.tsx"));
  for (const name of ["SkillLockArt", "SkillTickArt", "SkillBookArt", "SkillCalendarArt"]) assert.match(art, new RegExp(`export function ${name}\\(`), name);
  assert.match(art, /aria-hidden="true"/);
  assert.match(art, /focusable="false"/);
  assert.match(art, /const INK = "var\(--text\)";/);
  assert.doesNotMatch(art, /<img|<image|from "(?!react)[^"]+"/, "no images and no imports");
  for (const f of ALL_NEW.filter((x) => x.endsWith(".tsx"))) {
    assert.doesNotMatch(code(f), /<img\b|next\/image|dangerouslySetInnerHTML/, rel(f));
  }
});

test("layout: one narrow column (max-w-xl), the journal theme wrapper, mobile first", () => {
  const shell = code(join(COMPONENT_DIR, "skills-shell.tsx"));
  assert.match(shell, /<JournalTheme>/);
  assert.match(shell, /mx-auto w-full max-w-xl px-4/);
  for (const f of componentFiles.filter((x) => /-view\.tsx$/.test(x))) assert.match(code(f), /<SkillsShell>|SkillsErrorView/, rel(f));
});

test("states: the error is a friendly sentence in the journal error box, never a raw error, a code or a stack", () => {
  const shell = code(join(COMPONENT_DIR, "skills-shell.tsx"));
  assert.match(shell, /import \{ errorBox, focusRing \} from "@\/components\/journal-auth-ui";/);
  assert.match(shell, /<div role="alert" className=\{errorBox\}>\s*\{"Can't load this right now\. Try again in a minute\."\}\s*<\/div>/);
  for (const f of ALL_NEW) {
    const src = code(f);
    assert.doesNotMatch(src, /\berror\.(message|digest|stack|name|cause)\b|String\(error\)|JSON\.stringify\(error|console\./, rel(f));
    // a short code may be COMPARED (to choose a 404), never drawn: every use is `=== "no-pack"` or `=== "no-week"`
    for (const m of src.matchAll(/\berror\.code\b(?!\s*===\s*"no-(?:pack|week)")/g)) assert.fail(`${rel(f)}: error.code is used for something other than a 404 choice (at ${m.index})`);
  }
  // no spinner, no skeleton: the pages are server rendered
  for (const f of ALL_NEW) assert.doesNotMatch(code(f), /animate-|spinner|skeleton|Suspense|loading\.tsx/i, rel(f));
  assert.ok(!appFiles.some((f) => /loading\.tsx$/.test(f)));
});

test("wording: no new file says 'missed' or 'failed', and none says the feature is live, new or coming", () => {
  for (const f of ALL_NEW) {
    const src = code(f);
    assert.doesNotMatch(src, /missed|failed/i, rel(f));
    assert.doesNotMatch(src, /now live|is live|just launched|new feature|coming soon|beta|launch/i, rel(f));
  }
});

test("empty state: the home says exactly 'Start with Week 1, Day 1' and the one button says one of the three approved things", () => {
  const state = code(join(LIB_DIR, "home-state.ts"));
  assert.match(state, /EMPTY_LINE = "Start with Week 1, Day 1";/);
  assert.match(state, /START_LABEL = "Start today's session";/);
  assert.match(state, /WAIT_LABEL = "Come back tomorrow";/);
  assert.match(state, /`Review \(\$\{due\} due\)`/);
  const home = code(join(COMPONENT_DIR, "skills-home-view.tsx"));
  assert.equal((home.match(/primaryButton/g) ?? []).length, 3, "one import and the link/disabled pair of the single primary button");
});

// ---------------------------------------------------------------------------
// links only to pages that exist
// ---------------------------------------------------------------------------

test("pages-ready: a flag is true only when its page file exists, and the home draws those links only behind the flag", () => {
  const files: Record<string, string> = {
    session: join(PAGES_DIR, "session/page.tsx"),
    review: join(PAGES_DIR, "review/page.tsx"),
    notebook: join(PAGES_DIR, "notebook/page.tsx"),
  };
  for (const [name, on] of Object.entries(SKILLS_PAGES)) {
    assert.equal(existsSync(files[name]!), on, `${name}: flag ${on} but page file ${existsSync(files[name]!) ? "exists" : "is missing"}`);
  }
  assert.deepEqual({ ...SKILLS_PAGE_PATHS }, { session: "/skills/session", review: "/skills/review", notebook: "/skills/notebook" });
  const home = code(join(COMPONENT_DIR, "skills-home-view.tsx"));
  assert.match(home, /\{SKILLS_PAGES\.review \? \(\s*<Link href=\{SKILLS_PAGE_PATHS\.review\}/);
  assert.match(home, /\{SKILLS_PAGES\.notebook \? \(\s*<Link href=\{SKILLS_PAGE_PATHS\.notebook\}/);
  assert.match(home, /\{SKILLS_PAGES\.review \|\| SKILLS_PAGES\.notebook \? \(/);
  assert.match(home, /ready \? \(\s*<Link href=\{href\}/);
  // no page hard-codes a link to a page that is not built
  for (const f of ALL_NEW.filter((x) => x.endsWith(".tsx"))) {
    assert.doesNotMatch(code(f), /["'`]\/skills\/(session|review|notebook|test)\b/, `${rel(f)}: a hard-coded link to an unbuilt page`);
  }
});

// ---------------------------------------------------------------------------
// tracking
// ---------------------------------------------------------------------------

test("tracking: the five events, with short fixed values only, through track() in one tiny client component", () => {
  const t = code(join(COMPONENT_DIR, "skills-track.tsx"));
  assert.match(t, /^"use client";/);
  assert.match(t, /import \{ track \} from "@\/lib\/track";/);
  for (const e of ["skills_home_viewed", "skill_pack_map_viewed", "skill_handout_viewed", "skill_locked_viewed", "skill_upgrade_clicked"]) {
    assert.ok(t.includes(`"${e}"`), e);
  }
  assert.match(t, /event: "skills_home_viewed"; props: \{ has_progress: boolean; due_reviews: number \}/);
  assert.match(t, /event: "skill_pack_map_viewed"; props: \{ pack: string; tier: "free" \| "pro" \}/);
  assert.match(t, /event: "skill_handout_viewed"; props: \{ week: number \}/);
  assert.match(t, /event: "skill_locked_viewed"; props: \{ month: number \}/);
  assert.match(t, /event: "skill_upgrade_clicked"; props: \{ month: number; source: "map" \| "handout" \| "step" \| "home" \}/);
  // nothing outside the tracker calls posthog or track directly, and nothing passes text from a person
  for (const f of ALL_NEW.filter((x) => !x.endsWith("skills-track.tsx"))) assert.doesNotMatch(code(f), /posthog|\btrack\(/, rel(f));
  assert.doesNotMatch(t, /\bemail\b|\btitle\b|\bteaser\b|question|answer|\bnote\b|\bbody\b|\bhint\b|\bname\b/i);
  // each page / panel sends its event
  assert.match(code(join(COMPONENT_DIR, "skills-home-view.tsx")), /event="skills_home_viewed" props=\{\{ has_progress: data\.hasProgress, due_reviews: data\.dueReviews \}\}/);
  assert.match(code(join(COMPONENT_DIR, "skills-pack-map-view.tsx")), /event="skill_pack_map_viewed" props=\{\{ pack: props\.packId, tier: props\.tier \}\}/);
  assert.match(code(join(COMPONENT_DIR, "skills-handout-view.tsx")), /event="skill_handout_viewed" props=\{\{ week: h\.weekNo \}\}/);
  const panel = code(join(COMPONENT_DIR, "skill-upgrade-panel.tsx"));
  assert.match(panel, /event="skill_locked_viewed" props=\{\{ month \}\}/);
  assert.match(panel, /trackSkills\(\{ event: "skill_upgrade_clicked", props: \{ month, source \} \}\)/);
});

// ---------------------------------------------------------------------------
// nothing public mentions the feature
// ---------------------------------------------------------------------------

test("nothing public changed: the landing, pricing, plans.ts, dashboard and sitemap never mention the skills pages", () => {
  const allowed = (f: string) =>
    rel(f).startsWith("app/skills/") ||
    rel(f).startsWith("app/api/skills/") ||
    rel(f).startsWith("lib/skills/") ||
    /^components\/(skills?-|journal-skill-art)/.test(rel(f)) ||
    /skills[\w-]*\.test\.ts$/.test(rel(f)) ||
    rel(f) === "lib/skills-wiring.test.ts" ||
    rel(f) === "lib/skills-pages.test.ts";
  const everything = walk(SRC).filter((f) => /\.(ts|tsx|css|md|json)$/.test(f) && !allowed(f));
  assert.ok(everything.length > 100, "the walk must actually find the source files");
  for (const f of everything) {
    const text = read(f);
    assert.doesNotMatch(text, /["'`(]\/skills\b|href=["']\/skills|SKILLS_ENABLED|skillsEnabled/, `${rel(f)} points at or switches the skills feature`);
  }
  assert.doesNotMatch(read(join(SRC, "lib/plans.ts")), /skill/i, "plans.ts is untouched by this feature");
  assert.doesNotMatch(read(join(SRC, "app/sitemap.ts")), /skill/i);
  assert.doesNotMatch(read(join(SRC, "app/robots.ts")), /skill/i);
});
