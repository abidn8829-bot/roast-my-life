"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

/**
 * Analytics for the "learn a skill" pages. Every event has a fixed name and fixed, short properties: numbers, booleans
 * and a few known words. Never user text, never an email, never a step's content.
 */
export type SkillsEvent =
  | { event: "skills_home_viewed"; props: { has_progress: boolean; due_reviews: number } }
  | { event: "skill_pack_map_viewed"; props: { pack: string; tier: "free" | "pro" } }
  | { event: "skill_handout_viewed"; props: { week: number } }
  | { event: "skill_locked_viewed"; props: { month: number } }
  | { event: "skill_upgrade_clicked"; props: { month: number; source: "map" | "handout" | "step" | "home" } };

const SHORT = /^[A-Za-z0-9_.:-]{1,40}$/;
const whole = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.min(999, Math.trunc(n))) : 0);

/** Sends one event with its properties cleaned to short fixed values. Safe to call anywhere on the client. */
export function trackSkills(e: SkillsEvent): void {
  switch (e.event) {
    case "skills_home_viewed":
      track(e.event, { has_progress: e.props.has_progress === true, due_reviews: whole(e.props.due_reviews) });
      return;
    case "skill_pack_map_viewed":
      track(e.event, { pack: SHORT.test(e.props.pack) ? e.props.pack : "unknown", tier: e.props.tier === "pro" ? "pro" : "free" });
      return;
    case "skill_handout_viewed":
      track(e.event, { week: whole(e.props.week) });
      return;
    case "skill_locked_viewed":
      track(e.event, { month: whole(e.props.month) });
      return;
    case "skill_upgrade_clicked":
      track(e.event, { month: whole(e.props.month), source: e.props.source });
      return;
  }
}

/** Renders nothing. Sends its event once, when the page appears. */
export function SkillsTrack(event: SkillsEvent) {
  const key = JSON.stringify(event);
  useEffect(() => {
    trackSkills(JSON.parse(key) as SkillsEvent);
  }, [key]);
  return null;
}
