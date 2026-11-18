import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { SkillsHandoutView } from "@/components/skills-handout-view";
import { skillsEnabled } from "@/lib/skills/enabled";
import { getHandout } from "@/lib/skills/skills-server";
import { loadViewer } from "../../../viewer";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Skills", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#DCE6EE" };

// The data part. The drawing is SkillsHandoutView, which takes plain props.
export default async function SkillsHandoutPage({ params }: { params: Promise<{ n: string }> }) {
  if (!skillsEnabled()) notFound();

  const { n } = await params;
  if (!/^\d{1,2}$/.test(n)) notFound();
  const weekNo = Number(n);

  const viewer = await loadViewer(`/skills/week/${weekNo}/handout`);
  if (viewer.kind === "error") return <SkillsHandoutView kind="error" />;

  const result = await getHandout(viewer.service, viewer.tier, weekNo);
  if ("error" in result) {
    if (result.error.code === "no-week" || result.error.code === "no-pack") notFound();
    return <SkillsHandoutView kind="error" />;
  }
  if ("locked" in result) return <SkillsHandoutView kind="locked" locked={result} email={viewer.email} />;
  return <SkillsHandoutView kind="ok" handout={result.data} />;
}
