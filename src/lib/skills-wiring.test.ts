// Run with: node --test src/lib/skills-wiring.test.ts   (Node 22.18+ / 23.6+, no extra dependencies)
//
// Pins how the "learn a skill" API routes (src/app/api/skills/**) are wired, by reading the route source (the same
// approach as first-roast-plan-wiring.test.ts). No network, no Groq, no database.
// What this protects: every route answers a plain 404 while the switch is off, before anything else; the plan is read
// on the server and never taken from the request; a note can never be saved before the safety checks pass, and a
// flagged or unchecked note can never reach the save; a safety pause blocks only the note save; the skills routes
// stay clear of scoring, check-in, streak and daily-limit code; nothing logs a request body or a note; and no route
// builds a correct-answer or explanation field of its own.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const here = (rel: string) => fileURLToPath(new URL(rel, import.meta.url));
const read = (path: string) => readFileSync(path, "utf8");

/** Removes block comments and `//` line comments (a `//` right after a colon, as in https://, is left alone). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const ROUTES_DIR = here("../app/api/skills");
const routeFiles = (readdirSync(ROUTES_DIR, { recursive: true }) as string[])
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => f.endsWith("route.ts"))
  .sort();
const routes: Record<string, string> = Object.fromEntries(routeFiles.map((f) => [f, stripComments(read(`${ROUTES_DIR}/${f}`))]));
const doRoute = routes["do/route.ts"]!;
const helpers = stripComments(read(here("./skills/route-helpers.ts")));

const SERVER_CALLS = /\b(recordProve|answerReview|getDueReviews|getWeeklyTest|saveTestResult|saveNotebookEntry|deleteNotebookEntry)\(/;

/** Every exported handler of a route file: its name and the code of its body (up to the next handler). */
function handlers(source: string): Array<{ name: string; code: string; firstStatement: string }> {
  const parts = source.split(/^export async function /m).slice(1);
  return parts.map((part) => {
    const name = part.match(/^(\w+)\(/)![1]!;
    const first = part.match(/\)\s*\{\n\s*([^\n]+)/);
    return { name, code: part, firstStatement: first ? first[1]!.trim() : "" };
  });
}

const at = (source: string, needle: string | RegExp, label = "the route") => {
  const index = typeof needle === "string" ? source.indexOf(needle) : source.search(needle);
  assert.notEqual(index, -1, `not found in ${label}: ${needle}`);
  return index;
};

// ---------------------------------------------------------------------------
// which routes exist
// ---------------------------------------------------------------------------

test("wiring: the skills routes are exactly do, prove, review, test and notebook/[id]", () => {
  assert.deepEqual(routeFiles, ["do/route.ts", "notebook/[id]/route.ts", "prove/route.ts", "review/route.ts", "test/route.ts"]);
  const names = Object.fromEntries(routeFiles.map((f) => [f, handlers(routes[f]!).map((h) => h.name)]));
  assert.deepEqual(names, {
    "do/route.ts": ["POST"],
    "notebook/[id]/route.ts": ["DELETE"],
    "prove/route.ts": ["POST"],
    "review/route.ts": ["GET", "POST"],
    "test/route.ts": ["GET", "POST"],
  });
});

// ---------------------------------------------------------------------------
// the switch, the login, the plan
// ---------------------------------------------------------------------------

test("wiring: every handler of every route starts with the switch: a plain 404, before anything else", () => {
  for (const f of routeFiles) {
    for (const h of handlers(routes[f]!)) {
      assert.equal(h.firstStatement, "if (!skillsEnabled()) return notFound();", `${f} ${h.name}`);
    }
  }
  for (const f of routeFiles) assert.match(routes[f]!, /import \{ skillsEnabled \} from "@\/lib\/skills\/enabled";/, f);
});

test("wiring: every handler checks the login right after the switch and before any plan, database or server-layer call", () => {
  for (const f of routeFiles) {
    for (const h of handlers(routes[f]!)) {
      const sw = at(h.code, "skillsEnabled()", `${f} ${h.name}`);
      const client = at(h.code, "createSupabaseServerClient()", `${f} ${h.name}`);
      const user = at(h.code, "auth.getUser()", `${f} ${h.name}`);
      const unauth = at(h.code, "if (!user) return unauthorized();", `${f} ${h.name}`);
      assert.ok(sw < client && client < user && user < unauth, `${f} ${h.name}: order switch, client, getUser, 401`);
      const rest = h.code.slice(unauth);
      assert.ok(rest.search(SERVER_CALLS) > 0, `${f} ${h.name}: calls the server layer after the login check`);
      assert.ok(h.code.indexOf("createSupabaseServiceClient") === -1 || h.code.indexOf("openService(") > unauth, `${f} ${h.name}: service client only after login`);
    }
  }
});

test("wiring: the plan is read on the server (readTier) after the login and before the server layer, and passed on", () => {
  for (const f of routeFiles.filter((r) => r !== "notebook/[id]/route.ts")) {
    for (const h of handlers(routes[f]!)) {
      const user = at(h.code, "if (!user) return unauthorized();", `${f} ${h.name}`);
      const tier = at(h.code, "const tier = await readTier(supabase, user.id);", `${f} ${h.name}`);
      const call = at(h.code, SERVER_CALLS, `${f} ${h.name}`);
      assert.ok(user < tier && tier < call, `${f} ${h.name}: login, then tier, then the server layer`);
      assert.match(h.code, /\b(recordProve|answerReview|getDueReviews|getWeeklyTest|saveTestResult|saveNotebookEntry)\(service, user\.id, (?:weekId, )?tier\b/, `${f} ${h.name}: tier is passed to the server layer`);
    }
  }
  assert.match(helpers, /\.from\("users"\)\.select\("subscription_tier"\)\.eq\("id", userId\)\.single\(\)/, "readTier reads users.subscription_tier");
  assert.match(helpers, /data\?\.subscription_tier === "pro" \? "pro" : "free"/);
});

test("wiring: the plan is never taken from the request (body, query, headers, cookies, params)", () => {
  for (const f of routeFiles) {
    const src = routes[f]!;
    assert.doesNotMatch(src, /\.tier\b|["'`]tier["'`]|\btier\s*=\s*(?!await readTier)\S/, `${f}: tier only ever comes from readTier`);
    assert.doesNotMatch(src, /headers|cookies\(|\bsearchParams\.get\(["'`](?:tier|plan)/, `${f}`);
  }
});

test("wiring: the notebook DELETE has no plan check on purpose (a user can always remove their own note)", () => {
  const src = routes["notebook/[id]/route.ts"]!;
  assert.match(src, /deleteNotebookEntry\(service, user\.id, entryId\)/, "limited to the verified user and the note id");
  assert.doesNotMatch(src, /readTier|tier/);
});

test("wiring: reads and test answers are never blocked by a pause: only the note save uses the safety pause", () => {
  for (const f of routeFiles.filter((r) => r !== "do/route.ts")) {
    assert.doesNotMatch(routes[f]!, /gentleGate|respondGentle|getGentleState|respondFlagged|respondUnavailable|runSafetyClassify|ruleFloorLevel/, f);
  }
});

// ---------------------------------------------------------------------------
// the note save (do route)
// ---------------------------------------------------------------------------

test("wiring: do route order: switch, login, plan, input, step access, pause, clip, empty, phrase rules, classifier, combine, exits, save", () => {
  const order = [
    "if (!skillsEnabled()) return notFound();",
    "auth.getUser()",
    "const tier = await readTier(supabase, user.id);",
    "const stepId = asId(body?.stepId);",
    "checkStepAccess(service, user.id, tier, stepId)",
    "const gentle = await gentleGate(supabase, user.id);",
    "if (gentle) return gentle;",
    "const text = clipNote(rawText);",
    'return badRequest("empty");',
    "const ruleLevel = ruleFloorLevel(text);",
    "if (ruleLevel !== 2) {",
    "runSafetyClassify(",
    "const decision = combineSignals(",
    'if (decision.kind === "unavailable") return respondUnavailable("skills-do");',
    "if (decision.level !== 0) {",
    "return respondFlagged(",
    "saveNotebookEntry(",
  ];
  let last = -1;
  for (const needle of order) {
    const i = at(doRoute, needle, "the do route");
    assert.ok(i > last, `out of order in the do route: ${needle}`);
    last = i;
  }
});

test("wiring: the save is called exactly once, last, with the clipped and checked text, and nothing can reach it after a flag", () => {
  assert.equal(doRoute.match(/saveNotebookEntry\(/g)?.length, 1);
  assert.match(doRoute, /return mapResult\(await saveNotebookEntry\(service, user\.id, tier, stepId, text\)\);\s*\}\s*$/);
  // between the combined decision and the save there are only the two exits, and both of them return
  const between = doRoute.slice(at(doRoute, "const decision = combineSignals("), at(doRoute, "return mapResult(await saveNotebookEntry("));
  const afterDecision = between.slice(between.indexOf(";") + 1);
  assert.match(
    afterDecision,
    /^\s*if \(decision\.kind === "unavailable"\) return respondUnavailable\("skills-do"\);\s*if \(decision\.level !== 0\) \{\s*return respondFlagged\([^;]*\);\s*\}\s*$/,
  );
  // the raw text from the browser is not used after it has been clipped
  assert.doesNotMatch(doRoute.slice(at(doRoute, "clipNote(rawText)") + "clipNote(rawText)".length), /rawText/);
  assert.equal(doRoute.match(/body\?\.text/g)?.length, 1);
});

test("wiring: the classifier is asked once, only when no phrase rule fired at level 2, and gets the overlapping pieces", () => {
  assert.equal(doRoute.match(/runSafetyClassify\(/g)?.length, 1);
  assert.match(doRoute, /if \(ruleLevel !== 2\) \{[\s\S]*?runSafetyClassify\(groq, SAFETY_MODEL, classifierTexts\(text\)\)[\s\S]*?\n  \}\n/);
  assert.match(doRoute, /combineSignals\(\{ rule: ruleLevel, classify \}\)/);
  assert.match(doRoute, /import \{ classifierTexts, clipNote \} from "@\/lib\/skills\/notebook-texts";/);
});

test("wiring: a pause saves nothing and answers with the existing pause response (the gate's own result is returned)", () => {
  assert.match(doRoute, /import \{ gentleGate, respondFlagged, respondUnavailable \} from "@\/lib\/safety-response";/);
  assert.match(doRoute, /const gentle = await gentleGate\(supabase, user\.id\);\s*if \(gentle\) return gentle;/);
});

test("wiring: a flagged note goes through the existing respondFlagged; the step is never marked done by this route", () => {
  assert.match(doRoute, /respondFlagged\(\{ request, route: "skills-do", level: decision\.level, userId: user\.id, groq, texts: \[text\] \}\)/);
  assert.doesNotMatch(doRoute, /recordProve|skill_step_progress|completed_at/);
  assert.doesNotMatch(doRoute, /insert\(|upsert\(|update\(|\.from\(/, "the route itself writes nothing");
});

test("wiring: step access is checked before the pause and before any safety call, and refuses with a plain 403 or the locked body", () => {
  const access = at(doRoute, "checkStepAccess(");
  assert.ok(access < at(doRoute, "gentleGate(") && access < at(doRoute, "ruleFloorLevel(") && access < at(doRoute, "runSafetyClassify("));
  assert.match(doRoute, /const problem = stepAccessProblem\(await checkStepAccess\(service, user\.id, tier, stepId\)\);\s*if \(problem\) return problem;/);
  assert.match(helpers, /export const plainForbidden = \(\) => new Response\(null, \{ status: 403/);
  assert.match(helpers, /if \("notOpened" in access\) return plainForbidden\(\);/);
});

// ---------------------------------------------------------------------------
// what the routes may import
// ---------------------------------------------------------------------------

const ALLOWED_ROUTE_IMPORTS = new Set([
  "groq-sdk",
  "@/lib/groq-error",
  "@/lib/safety",
  "@/lib/safety-response",
  "@/lib/safety-server",
  "@/lib/skills/enabled",
  "@/lib/skills/notebook-texts",
  "@/lib/skills/route-helpers",
  "@/lib/skills/skills-server",
  "@/lib/supabase/server",
  "@/lib/supabase/service",
]);
const FORBIDDEN_MODULE = /(?:^|\/)(?:grades|daily-limit|streak|achievements|achievement-push|changed-scores|parse-category-scores|percentile|arc-[\w-]+|missions(?:-server)?|check-in|roast|roast-[\w-]+|gumroad|plans)(?:\.ts)?$/;
const importsOf = (source: string) => [...source.matchAll(/(?:^|\n)\s*(?:import|export)\s[^;]*?from\s+["']([^"']+)["']/g)].map((m) => m[1]!);

test("wiring: skills routes import only an approved list, and nothing from scoring, check-in, streak or the daily limit", () => {
  for (const f of routeFiles) {
    const imports = importsOf(routes[f]!);
    assert.ok(imports.length > 0, f);
    for (const spec of imports) {
      assert.ok(ALLOWED_ROUTE_IMPORTS.has(spec), `${f} imports ${spec}, which is not on the approved list`);
      assert.doesNotMatch(spec, FORBIDDEN_MODULE, `${f} imports ${spec}`);
    }
  }
});

test("wiring: the skills library files (tests excluded) stay clear of scoring, check-in, streak and the daily limit too", () => {
  const dir = here("./skills");
  const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  assert.ok(files.includes("route-helpers.ts") && files.includes("enabled.ts") && files.includes("notebook-texts.ts"));
  for (const f of files) {
    for (const spec of importsOf(stripComments(read(`${dir}/${f}`)))) {
      assert.ok(spec.startsWith("./") || spec === "../is-uuid.ts" || spec === "@supabase/supabase-js", `${f} imports ${spec}`);
      assert.doesNotMatch(spec, FORBIDDEN_MODULE, `${f} imports ${spec}`);
    }
  }
});

// ---------------------------------------------------------------------------
// logging and responses
// ---------------------------------------------------------------------------

test("wiring: no route logs, and none reads the raw request text or builds JSON from the body", () => {
  for (const f of routeFiles) {
    assert.doesNotMatch(routes[f]!, /console\.|logGroqError|\.text\(\)|JSON\.stringify|JSON\.parse|\.formData\(|\.json\(\)/, f);
  }
});

test("wiring: the only log lines in the route helpers carry a route name and a short code, never a body or text", () => {
  const calls = helpers.split("\n").filter((l) => l.includes("console."));
  assert.ok(calls.length >= 2);
  for (const line of calls) {
    assert.match(line.trim(), /^console\.error\(["`]\[skills-route\] [a-z ]+ error code=(?:\$\{shortCode\(code\)\}|no-service-client)["`]\);$/, line);
    assert.doesNotMatch(line, /body|text|request|note|answer/i);
  }
});

test("wiring: no route or helper builds a correct-answer, answer-index or explanation field", () => {
  const field = /\b(prove_correct|prove_explanation|prove_options|correct|correctIndex|explanation)\b/;
  for (const f of routeFiles) assert.doesNotMatch(routes[f]!, field, f);
  assert.doesNotMatch(helpers, field);
  for (const f of routeFiles) assert.doesNotMatch(routes[f]!, /\.from\(|\.select\(/, `${f}: routes never query tables themselves`);
});

test("wiring: results go out only through mapResult, and a server error never shows more than a short code", () => {
  for (const f of routeFiles) {
    assert.doesNotMatch(routes[f]!, /Response\.json|NextResponse|new Response/, `${f}: responses come from the helpers`);
  }
  assert.match(helpers, /if \("error" in result\) return errorResponse\(result\.error\.code\);/);
  assert.match(helpers, /NOT_FOUND_CODES\.has\(code\) \? json\(\{ error: shortCode\(code\) \}, 404\) : serverError\(code\)/);
  assert.match(helpers, /export const serverError = \(code: string\) => json\(\{ error: shortCode\(code\) \}, 500\);/);
  assert.match(helpers, /if \("locked" in result\) return lockedResponse\(result\);/);
  assert.match(helpers, /json\(\{ locked: true, month: locked\.month, teaser: locked\.teaser \}, 403\)/);
  assert.match(helpers, /if \("notReady" in result\) return json\(\{ notReady: true \}, 200\);/);
  assert.match(helpers, /return json\(result\.data, 200\);/);
});

test("wiring: the switch off answers as if the route does not exist: a plain 404 with no body, built before any I/O", () => {
  assert.match(helpers, /export const notFound = \(\) => new Response\(null, \{ status: 404/);
  const enabled = stripComments(read(here("./skills/enabled.ts")));
  assert.match(enabled, /return process\.env\.SKILLS_ENABLED === "1";/);
  assert.doesNotMatch(enabled, /NEXT_PUBLIC/);
});
