"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OnboardingAnswers } from "@/lib/roast-types";
import posthog from "posthog-js";

const LOADING_MESSAGES = [
  "Analyzing your poor life choices...",
  "Counting your regrets...",
  "Consulting the council of disappointment...",
  "Almost done judging you...",
];

const QUESTIONS = [
  {
    key: "phoneHours" as const,
    label: "How many hours a day are you on your phone?",
    type: "number" as const,
    min: 1,
    max: 20,
    placeholder: "8",
  },
  {
    key: "worstApp" as const,
    label: "What app do you waste the most time on?",
    type: "text" as const,
    placeholder: "TikTok, Instagram…",
  },
  {
    key: "sleepHours" as const,
    label: "How many hours of sleep do you get on average?",
    type: "number" as const,
    min: 1,
    max: 12,
    placeholder: "6",
  },
  {
    key: "foodDeliverySpend" as const,
    label: "How much do you spend on food delivery per week in dollars?",
    type: "number" as const,
    min: 0,
    placeholder: "75",
  },
  {
    key: "neverDoThing" as const,
    label: "What's one thing you keep saying you'll do but never do?",
    type: "text" as const,
    placeholder: "Go to the gym, read more…",
  },
];

type Step = number | "loading";

const inputClass =
  "w-full rounded-md border border-neutral-800 bg-[#141414] px-3 py-2.5 text-[#FAFAFA] outline-none ring-[#FF3D00] focus:ring-2";

const labelClass =
  "text-lg font-medium leading-relaxed text-[#FAFAFA] break-words whitespace-normal";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    posthog.capture('onboarding_started');
  }, []);

  const [phoneHours, setPhoneHours] = useState("");
  const [worstApp, setWorstApp] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [foodDeliverySpend, setFoodDeliverySpend] = useState("");
  const [neverDoThing, setNeverDoThing] = useState("");
  const roastStarted = useRef(false);

  const values: Record<(typeof QUESTIONS)[number]["key"], string> = {
    phoneHours,
    worstApp,
    sleepHours,
    foodDeliverySpend,
    neverDoThing,
  };

  const setters: Record<(typeof QUESTIONS)[number]["key"], (v: string) => void> =
    {
      phoneHours: setPhoneHours,
      worstApp: setWorstApp,
      sleepHours: setSleepHours,
      foodDeliverySpend: setFoodDeliverySpend,
      neverDoThing: setNeverDoThing,
    };

  function validateStep(index: number): boolean {
    const q = QUESTIONS[index];
    const raw = values[q.key].trim();
    if (!raw) return false;
    if (q.type === "number") {
      const n = Number(raw);
      if (!Number.isFinite(n)) return false;
      if (q.min != null && n < q.min) return false;
      if (q.max != null && n > q.max) return false;
    }
    return true;
  }

  function buildAnswers(): OnboardingAnswers {
    return {
      phoneHours: Number(phoneHours),
      worstApp: worstApp.trim(),
      sleepHours: Number(sleepHours),
      foodDeliverySpend: Number(foodDeliverySpend),
      neverDoThing: neverDoThing.trim(),
    };
  }

  const generateRoast = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildAnswers()),
    });
    const data = (await res.json()) as { id?: string; error?: string };
    const roastId =
      typeof data.id === "string" ? data.id.trim() : String(data.id ?? "");

    if (!res.ok || !roastId) {
      console.error("[onboarding] roast API failed:", res.status, data);
      setError(data.error ?? "Something went wrong. Try again.");
      setStep(4);
      return;
    }

    console.log("[onboarding] redirecting to roast:", roastId);
    posthog.capture('roast_generated');
    router.push(`/roast/${encodeURIComponent(roastId)}`);
    router.refresh();
  }, [phoneHours, worstApp, sleepHours, foodDeliverySpend, neverDoThing, router]);

  useEffect(() => {
    if (step !== "loading") return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (step !== "loading" || roastStarted.current) return;
    roastStarted.current = true;
    void generateRoast();
  }, [step, generateRoast]);

  function onNext() {
    if (typeof step !== "number") return;
    if (!validateStep(step)) {
      setError("Fill in a valid answer to continue.");
      return;
    }
    setError(null);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setStep("loading");
      setLoadingMsgIndex(0);
    }
  }

  function onBack() {
    if (typeof step !== "number" || step === 0) return;
    setError(null);
    setStep(step - 1);
  }

  if (step === "loading") {
    return (
      <div className="w-full max-w-md text-center">
        <p className="text-lg text-[#FAFAFA] animate-pulse">
          {LOADING_MESSAGES[loadingMsgIndex]}
        </p>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </div>
    );
  }

  const slideIndex = step;
  const q = QUESTIONS[slideIndex];

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex items-center justify-between text-sm text-neutral-500">
        <span>
          {slideIndex + 1} / {QUESTIONS.length}
        </span>
        <div className="flex gap-1">
          {QUESTIONS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i <= slideIndex ? "bg-[#FF3D00]" : "bg-neutral-800"
              }`}
            />
          ))}
        </div>
      </div>

      <div
        key={q.key}
        className="transition-opacity duration-300"
      >
        <label className="flex flex-col gap-3">
          <span className={labelClass}>{q.label}</span>
          {q.type === "text" ? (
            <textarea
              rows={3}
              placeholder={q.placeholder}
              value={values[q.key]}
              onChange={(e) => setters[q.key](e.target.value)}
              className={`${inputClass} resize-y min-h-[2.75rem]`}
            />
          ) : (
            <input
              type="number"
              min={q.min}
              max={q.max}
              placeholder={q.placeholder}
              value={values[q.key]}
              onChange={(e) => setters[q.key](e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onNext();
              }}
              className={inputClass}
            />
          )}
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-8 flex justify-between gap-3">
        {slideIndex > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 transition hover:border-neutral-500"
          >
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onNext}
          className="ml-auto rounded-md bg-[#FF3D00] px-5 py-2.5 text-sm font-medium text-white transition hover:brightness-110"
        >
          {slideIndex === QUESTIONS.length - 1 ? "Roast me" : "Next"}
        </button>
      </div>
    </div>
  );
}
