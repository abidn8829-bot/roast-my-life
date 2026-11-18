import { asId, asIndex, badRequest, mapResult, notFound, openService, readBody, readTier, unauthorized } from "@/lib/skills/route-helpers";
import { skillsEnabled } from "@/lib/skills/enabled";
import { recordProve } from "@/lib/skills/skills-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Answer a step's question. The server grades it (recordProve); the correct answer is never sent by the browser.
export async function POST(request: Request) {
  if (!skillsEnabled()) return notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();
  const tier = await readTier(supabase, user.id);

  const body = await readBody(request);
  const stepId = asId(body?.stepId);
  const chosenIndex = asIndex(body?.chosenIndex);
  if (!stepId || chosenIndex === null) return badRequest("invalid");

  const service = openService(createSupabaseServiceClient);
  if (service instanceof Response) return service;
  return mapResult(await recordProve(service, user.id, tier, stepId, chosenIndex));
}
