import { notFound, redirect } from "next/navigation";
import { RoastView } from "@/components/roast-view";
import { isUuid } from "@/lib/is-uuid";
import { parseReportCard } from "@/lib/parse-report-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RoastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isUuid(param)) {
    if (!user) {
      redirect(`/login?next=/roast/${param}`);
    }

    const { data, error } = await supabase
      .from("roasts")
      .select("id, roast_text, report_card, share_slug, reaction, user_id")
      .eq("id", param)
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !data) {
      notFound();
    }

    const reportCard = parseReportCard(data.report_card);
    if (!reportCard) {
      notFound();
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
        <RoastView
          roastId={data.id}
          roastText={data.roast_text}
          reportCard={reportCard}
          shareSlug={data.share_slug}
          initialReaction={data.reaction}
          canReact
        />
      </main>
    );
  }

  const { data, error } = await supabase.rpc("get_roast_by_share_slug", {
    p_slug: param,
  });

  if (error || !data?.length) {
    notFound();
  }

  const row = data[0] as {
    id: string;
    roast_text: string;
    report_card: unknown;
    share_slug: string;
  };

  const reportCard = parseReportCard(row.report_card);
  if (!reportCard) {
    notFound();
  }

  let initialReaction: string | null = null;
  let canReact = false;
  if (user) {
    const { data: owned } = await supabase
      .from("roasts")
      .select("reaction")
      .eq("id", row.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (owned) {
      canReact = true;
      initialReaction = owned.reaction;
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
      <RoastView
        roastId={row.id}
        roastText={row.roast_text}
        reportCard={reportCard}
        shareSlug={row.share_slug}
        initialReaction={initialReaction}
        canReact={canReact}
      />
    </main>
  );
}
