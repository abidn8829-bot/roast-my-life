import { asId, badRequest, mapResult, notFound, openService, unauthorized } from "@/lib/skills/route-helpers";
import { skillsEnabled } from "@/lib/skills/enabled";
import { deleteNotebookEntry } from "@/lib/skills/skills-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Delete one of the user's own notes. No plan check by design: a user can always remove their own note, even
// after their plan ended (deleteNotebookEntry takes no plan and is limited to this id AND this user).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!skillsEnabled()) return notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const entryId = asId((await params).id);
  if (!entryId) return badRequest("invalid");

  const service = openService(createSupabaseServiceClient);
  if (service instanceof Response) return service;
  return mapResult(await deleteNotebookEntry(service, user.id, entryId));
}
