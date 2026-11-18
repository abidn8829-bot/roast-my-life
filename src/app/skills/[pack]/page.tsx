import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { SkillsPackMapView } from "@/components/skills-pack-map-view";
import { skillsEnabled } from "@/lib/skills/enabled";
import { getHome, getPackMap } from "@/lib/skills/skills-server";
import { loadViewer } from "../viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Skills", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#DCE6EE" };

// The data part. The drawing is SkillsPackMapView, which takes plain props.
export default async function SkillsPackPage({ params }: { params: Promise<{ pack: string }> }) {
  if (!skillsEnabled()) notFound();

  const { pack: rawPack } = await params;
  const packId = decodeURIComponent(rawPack).trim();
  if (!packId || packId.length > 80) notFound();

  const viewer = await loadViewer(`/skills/${encodeURIComponent(packId)}`);
  if (viewer.kind === "error") return <SkillsPackMapView kind="error" />;

  const map = await getPackMap(viewer.service, viewer.tier, { packId });
  if ("error" in map) {
    if (map.error.code === "no-pack") notFound();
    return <SkillsPackMapView kind="error" />;
  }
  if ("locked" in map) return <SkillsPackMapView kind="error" />;

  const home = await getHome(viewer.service, viewer.userId, viewer.tier, { packId });
  if (!("data" in home)) return <SkillsPackMapView kind="error" />;

  return (
    <SkillsPackMapView
      kind="ok"
      packId={map.data.packId}
      packTitle={home.data.packTitle}
      tier={viewer.tier}
      months={map.data.months}
      progress={home.data.progress}
      email={viewer.email}
    />
  );
}
