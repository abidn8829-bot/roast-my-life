import { NextResponse } from "next/server";
import { isReactionEmoji } from "@/lib/reactions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emoji =
    body && typeof body === "object" && "emoji" in body
      ? String((body as { emoji: unknown }).emoji)
      : "";

  if (!isReactionEmoji(emoji)) {
    return NextResponse.json({ error: "Invalid reaction" }, { status: 400 });
  }

  const { error } = await supabase
    .from("roasts")
    .update({ reaction: emoji })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    console.error("Reaction save error:", error);
    return NextResponse.json(
      { error: "Failed to save reaction" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, reaction: emoji });
}
