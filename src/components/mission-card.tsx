"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { MissionDay, MissionView } from "@/lib/missions";
import { getUpgradeUrl, UPGRADE_EMAIL_HINT } from "@/lib/upgrade-url";

type MissionResponse = { mission: MissionView | null; canStart: boolean; reason?: string };

function DayPill({ day, isToday }: { day: MissionDay | { day: number; status: "upcoming" }; isToday: boolean }) {
  const status = day.status;
  const base = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold";
  const label =
    status === "done" ? "✅" : status === "missed" ? "❌" : String(day.day);
  const style =
    status === "done"
      ? "bg-grade-a/15"
      : status === "missed"
        ? "bg-grade-f/15"
        : isToday
          ? "border-2 border-ember text-ember"
          : "border border-border text-text-faint";
  return (
    <span className={`${base} ${style}`} title={`Day ${day.day}${isToday ? " (today)" : ""}: ${status}`}>
      {label}
    </span>
  );
}

function GapBar({ mission }: { mission: MissionView }) {
  const span = Math.max(1, mission.targetScore - mission.baselineScore);
  const progress = Math.min(100, Math.max(0, ((mission.currentScore - mission.baselineScore) / span) * 100));
  const gap = mission.targetScore - mission.currentScore;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between text-sm">
        <span className="text-text">
          <span className="font-semibold tabular-nums">{mission.currentScore}</span>
          <span className="text-text-faint"> now → </span>
          <span className="font-semibold tabular-nums">{mission.targetScore}</span>
          <span className="text-text-faint"> target</span>
        </span>
        <span className="text-xs text-text-muted">{gap > 0 ? `${gap} to go · ${mission.targetLabel}` : "target hit 🔥"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full bg-ember transition-all duration-200" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function StepBlock({ title, step, why }: { title: string; step: string; why: string | null }) {
  return (
    <div className="rounded-xl border border-ember/30 bg-ember-soft p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-ember">{title}</p>
      <p className="mt-1 text-sm font-medium text-text">{step}</p>
      {why && <p className="mt-1 text-xs text-text-muted">{why}</p>}
    </div>
  );
}

function LockedMission({ compact, userEmail }: { compact: boolean; userEmail?: string }) {
  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none space-y-3 rounded-xl border border-border bg-surface-3 p-4 blur-sm select-none">
        <p className="text-sm font-semibold text-text">Sleep mission: Day 3 of 7</p>
        <div className="h-2 w-full rounded-full bg-surface-2">
          <div className="h-full w-2/5 rounded-full bg-ember" />
        </div>
        <div className="flex gap-2">
          {["✅", "❌", "3", "4", "5", "6", "7"].map((d, i) => (
            <span key={i} className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-xs">
              {d}
            </span>
          ))}
        </div>
        {!compact && <p className="text-xs text-text-muted">The leak: your focus crashes on days after late nights.</p>}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-2/80 p-4 text-center">
        <p className="text-sm font-semibold text-text">7-day missions that find your leak</p>
        {!compact && (
          <p className="text-xs text-text-muted">
            A tracked mission on your weakest category, with a real target and a new step every day that adapts to what you actually did.
          </p>
        )}
        <a
          href={getUpgradeUrl(userEmail)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-block rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Upgrade to Pro 🔥
        </a>
        <p className="text-xs text-text-faint">{UPGRADE_EMAIL_HINT}</p>
      </div>
    </div>
  );
}

type Props = { isPro: boolean; variant: "compact" | "full"; userEmail?: string };

export function MissionCard({ isPro, variant, userEmail }: Props) {
  const [data, setData] = useState<MissionResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<null | "start" | "done" | "missed" | "abandon">(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPro) return;
    let cancelled = false;
    fetch("/api/missions")
      .then((res) => {
        if (!res.ok) throw new Error("failed");
        return res.json() as Promise<MissionResponse>;
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isPro]);

  const act = useCallback(async (kind: "start" | "done" | "missed" | "abandon") => {
    if (kind === "abandon" && !window.confirm("Abandon this mission? It'll be saved as abandoned and you can start a new one.")) return;
    setBusy(kind);
    setActionError(null);
    try {
      const url = kind === "start" ? "/api/missions" : kind === "abandon" ? "/api/missions/abandon" : "/api/missions/today";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: kind === "done" || kind === "missed" ? JSON.stringify({ status: kind }) : undefined,
      });
      const json = (await res.json()) as MissionResponse & { error?: string };
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      setData(json);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }, []);

  if (!isPro) return <LockedMission compact={variant === "compact"} userEmail={userEmail} />;
  if (loadError) return <p className="text-sm text-text-faint">Couldn&apos;t load your mission. Refresh to try again.</p>;
  if (!data) return <p className="text-sm text-text-faint">Loading your mission…</p>;

  const mission = data.mission;
  const active = mission?.status === "active" ? mission : null;
  const errorLine = actionError && <p className="text-xs text-grade-f">{actionError}</p>;

  const startButton = (label: string) => (
    <button
      type="button"
      onClick={() => act("start")}
      disabled={busy !== null}
      className="rounded-lg bg-ember px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
    >
      {busy === "start" ? "Finding your leak…" : label}
    </button>
  );

  // ---------- compact (dashboard) ----------
  if (variant === "compact") {
    const step = active?.today?.step ? active.today : null;
    return (
      <div className="space-y-3 rounded-xl border border-ember/30 bg-ember-soft px-4 py-3">
        {active ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-ember">
              {active.label} mission · Day {active.dayNumber} of 7
            </p>
            {step?.step ? (
              <p className="text-sm text-text">{step.step}</p>
            ) : active.fallbackStep ? (
              <p className="text-sm text-text">{active.fallbackStep.step}</p>
            ) : null}
            {errorLine}
            <div className="flex items-center justify-between gap-3">
              {!active.today || active.today.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => act("done")}
                  disabled={busy !== null}
                  className="rounded-lg bg-ember px-3 py-1.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {busy === "done" ? "Saving…" : "Done ✅"}
                </button>
              ) : (
                <span className="text-xs text-text-muted">
                  {active.today?.status === "done" ? "Done for today ✅" : active.today?.status === "missed" ? "Marked missed today" : ""}
                </span>
              )}
              <Link href="/arc" className="shrink-0 text-sm font-semibold text-ember hover:brightness-110">
                View your full Arc →
              </Link>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-text">
              {mission ? `${mission.label} mission ${mission.status}. Ready for the next one?` : "Start a 7-day mission on your weakest category."}
            </p>
            <Link href="/arc" className="shrink-0 text-sm font-semibold text-ember hover:brightness-110">
              View your full Arc →
            </Link>
          </div>
        )}
      </div>
    );
  }

  // ---------- full (/arc) ----------
  if (!active) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-surface-3 p-4">
        {mission ? (
          <>
            <p className="text-sm font-semibold text-text">
              {mission.label} mission:{" "}
              <span className={mission.status === "completed" ? "text-grade-a" : "text-text-muted"}>
                {mission.status === "completed" ? "completed 🔥" : mission.status === "failed" ? "target missed" : "abandoned"}
              </span>
            </p>
            <div className="flex gap-1.5">
              {Array.from({ length: 7 }, (_, i) => {
                const d = mission.days.find((x) => x.day === i + 1);
                return <DayPill key={i} day={d ?? { day: i + 1, status: "upcoming" }} isToday={false} />;
              })}
            </div>
            {mission.outcomeSummary && <p className="text-sm text-text-muted">{mission.outcomeSummary}</p>}
          </>
        ) : (
          <p className="text-sm text-text-muted">
            Ember picks your weakest category, finds the leak behind it, and gives you one step a day for 7 days, adjusted to what you actually did.
          </p>
        )}
        {data.reason && <p className="text-xs text-text-faint">{data.reason}</p>}
        {errorLine}
        {data.canStart && startButton(mission ? "Start next mission" : "Start my first mission")}
      </div>
    );
  }

  const today = active.today;
  const todayStep = today?.step ? { step: today.step, why: today.why } : null;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface-3 p-4">
      <p className="text-base font-semibold text-text">
        {active.label} mission: Day {active.dayNumber} of 7
      </p>

      <GapBar mission={active} />

      <div className="flex gap-1.5">
        {Array.from({ length: 7 }, (_, i) => {
          const d = active.days.find((x) => x.day === i + 1);
          const isToday = i + 1 === active.dayNumber;
          return <DayPill key={i} day={d && (d.status !== "pending" || isToday) ? d : { day: i + 1, status: "upcoming" }} isToday={isToday} />;
        })}
      </div>

      {active.rootCause && (
        <p className="text-sm text-text-muted">
          <span className="font-semibold text-text">The leak: </span>
          {active.rootCause}
        </p>
      )}

      {todayStep ? (
        <StepBlock title="Today's step" step={todayStep.step} why={todayStep.why} />
      ) : active.fallbackStep ? (
        <div>
          <StepBlock title="Keep going with" step={active.fallbackStep.step} why={active.fallbackStep.why} />
          <p className="mt-1 text-xs text-text-faint">Couldn&apos;t write today&apos;s new step. Refresh in a bit to get it.</p>
        </div>
      ) : null}

      {errorLine}

      {today?.status === "pending" || !today ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => act("done")}
            disabled={busy !== null}
            className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
          >
            {busy === "done" ? "Saving…" : "Done ✅"}
          </button>
          <button
            type="button"
            onClick={() => act("missed")}
            disabled={busy !== null}
            className="rounded-lg border border-border bg-surface-2 px-4 py-2.5 text-sm font-semibold text-text transition hover:border-text-faint disabled:opacity-60"
          >
            {busy === "missed" ? "Saving…" : "Missed ❌"}
          </button>
        </div>
      ) : (
        <p className="text-sm text-text-muted">
          {today.status === "done" ? "Done for today ✅" : "Marked missed. Tomorrow's step will adjust."}
        </p>
      )}

      {active.tomorrow?.step && (
        <StepBlock title="Tomorrow" step={active.tomorrow.step} why={active.tomorrow.why} />
      )}

      <button
        type="button"
        onClick={() => act("abandon")}
        disabled={busy !== null}
        className="text-xs text-text-faint underline-offset-2 hover:underline disabled:opacity-60"
      >
        {busy === "abandon" ? "Abandoning…" : "Abandon mission"}
      </button>
    </div>
  );
}
