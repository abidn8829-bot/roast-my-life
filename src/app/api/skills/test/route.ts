import { asId, asIndex, badRequest, mapResult, notFound, openService, readBody, readTier, unauthorized } from "@/lib/skills/route-helpers";
import { skillsEnabled } from "@/lib/skills/enabled";
import { getWeeklyTest, saveTestResult, type TestAnswer } from "@/lib/skills/skills-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// The weekly test's questions (no answers). Answers to "notReady" until the week's five steps are done.
export async function GET(request: Request) {
  if (!skillsEnabled()) return notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  const tier = await readTier(supabase, user.id);

  const weekId = asId(new URL(request.url).searchParams.get("weekId"));
  if (!weekId) return badRequest("invalid");

  const service = openService(createSupabaseServiceClient);
  if (service instanceof Response) return service;
  return mapResult(await getWeeklyTest(service, user.id, weekId, tier));
}

// Send the five answers; the server grades them and saves one result.
export async function POST(request: Request) {
  if (!skillsEnabled()) return notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  const tier = await readTier(supabase, user.id);

  const body = await readBody(request);
  const weekId = asId(body?.weekId);
  const rawAnswers = body?.answers;
  if (!weekId || !Array.isArray(rawAnswers) || rawAnswers.length > 20) return badRequest("invalid");
  const answers: TestAnswer[] = [];
  for (const raw of rawAnswers) {
    const item = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
    const itemId = asId(item?.itemId);
    const chosenIndex = asIndex(item?.chosenIndex);
    if (!itemId || chosenIndex === null) return badRequest("invalid");
    answers.push({ itemId, chosenIndex });
  }

  const service = openService(createSupabaseServiceClient);
  if (service instanceof Response) return service;
  return mapResult(await saveTestResult(service, user.id, tier, weekId, answers));
}
