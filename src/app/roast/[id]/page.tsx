import { notFound, redirect } from "next/navigation";
import { RoastView } from "@/components/roast-view";
import { fetchOwnRoastById } from "@/lib/fetch-own-roast";
import { isUuid } from "@/lib/is-uuid";
import { parseReportCard } from "@/lib/parse-report-card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function RoastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: param } = await params;
  const roastId = decodeURIComponent(param).trim();

  if (!roastId) {
    notFound();
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isUuid(roastId)) {
    if (!user) {
      redirect(`/login?next=/roast/${roastId}`);
    }

    const roast = await fetchOwnRoastById(supabase, roastId, user.id);
    if (!roast) {
      notFound();
    }

    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 py-12 text-[#FAFAFA]">
        <RoastView
          roastId={roast.id}
          roastText={roast.roast_text}
          reportCard={roast.report_card}
          shareSlug={roast.share_slug}
          initialReaction={roast.reaction}
          canReact
        />
      </main>
    );
  }

  const { data, error } = await supabase.rpc("get_roast_by_share_slug", {
    p_slug: roastId,
  });

  if (error || !data?.length) {
    console.error("[roast page] share slug lookup failed:", error?.message);
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
    const owned = await fetchOwnRoastById(supabase, row.id, user.id);
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
