import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { SkillsHomeView } from "@/components/skills-home-view";
import { skillsEnabled } from "@/lib/skills/enabled";
import { getHome } from "@/lib/skills/skills-server";
import { loadViewer } from "./viewer";

export const dynamic = "force-dynamic";

// Never indexed. (This page does not exist at all unless SKILLS_ENABLED is "1".)
export const metadata: Metadata = { title: "Skills", robots: { index: false, follow: false } };
export const viewport: Viewport = { themeColor: "#DCE6EE" };

// The data part. The drawing is SkillsHomeView, which takes plain props.
export default async function SkillsHomePage() {
  if (!skillsEnabled()) notFound();

  const viewer = await loadViewer("/skills");
  if (viewer.kind === "error") return <SkillsHomeView kind="error" />;

  const home = await getHome(viewer.service, viewer.userId, viewer.tier);
  if ("error" in home) {
    if (home.error.code === "no-pack") notFound();
    return <SkillsHomeView kind="error" />;
  }
  if ("locked" in home) return <SkillsHomeView kind="error" />;
  return <SkillsHomeView kind="ok" data={home.data} email={viewer.email} />;
}
