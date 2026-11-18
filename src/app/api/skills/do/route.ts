import Groq from "groq-sdk";
import { getGroqApiKey } from "@/lib/groq-error";
import { combineSignals, ruleFloorLevel, type SafetyLevel } from "@/lib/safety";
import { gentleGate, respondFlagged, respondUnavailable } from "@/lib/safety-response";
import { SAFETY_MODEL, runSafetyClassify } from "@/lib/safety-server";
import { skillsEnabled } from "@/lib/skills/enabled";
import { classifierTexts, clipNote } from "@/lib/skills/notebook-texts";
import { asId, badRequest, checkStepAccess, mapResult, notFound, openService, readBody, readTier, stepAccessProblem, unauthorized } from "@/lib/skills/route-helpers";
import { saveNotebookEntry } from "@/lib/skills/skills-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/** Far more than a note can be (600); anything bigger is refused before any work is done on it. */
const MAX_INPUT_CHARS = 5000;

// Save the user's note for a step. A note is free text, so it is safety-checked BEFORE anything is saved:
// a flagged or unchecked note is never saved. A pause blocks only this route's save, never reading or answering.
export async function POST(request: Request) {
  if (!skillsEnabled()) return notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  const tier = await readTier(supabase, user.id);

  const body = await readBody(request);
  const stepId = asId(body?.stepId);
  const rawText = typeof body?.text === "string" ? body.text : null;
  if (!stepId || rawText === null || rawText.length > MAX_INPUT_CHARS) return badRequest("invalid");

  const service = openService(createSupabaseServiceClient);
  if (service instanceof Response) return service;

  // Only a step the user has already opened (their current open step or an earlier one), on a month their plan opens.
  const problem = stepAccessProblem(await checkStepAccess(service, user.id, tier, stepId));
  if (problem) return problem;

  // A safety pause is on: save nothing, answer with the existing pause response.
  const gentle = await gentleGate(supabase, user.id);
  if (gentle) return gentle;

  const text = clipNote(rawText);
  if (text.trim() === "") return badRequest("empty");

  // Phrase rules first (no AI). A level 2 match is final, so the classifier is only asked when it is not level 2.
  // The classifier reads 500 characters per text, so the note goes in as overlapping pieces: every character is read.
  const ruleLevel = ruleFloorLevel(text);
  let groq: Groq | null = null;
  let classify: SafetyLevel | null = null;
  if (ruleLevel !== 2) {
    const apiKey = getGroqApiKey();
    if (apiKey) {
      groq = new Groq({ apiKey });
      classify = await runSafetyClassify(groq, SAFETY_MODEL, classifierTexts(text));
    }
  }
  const decision = combineSignals({ rule: ruleLevel, classify });
  // Could not check and no phrase matched: nothing saved, no flag.
  if (decision.kind === "unavailable") return respondUnavailable("skills-do");
  // Level 1 or 2: the flag and the support response, nothing saved.
  if (decision.level !== 0) {
    return respondFlagged({ request, route: "skills-do", level: decision.level, userId: user.id, groq, texts: [text] });
  }

  return mapResult(await saveNotebookEntry(service, user.id, tier, stepId, text));
}
