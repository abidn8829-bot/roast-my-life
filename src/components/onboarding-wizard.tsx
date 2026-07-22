"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { OnboardingAnswers, RoastTone, RoastMode, RoastPersona } from "@/lib/roast-types";
import posthog from "posthog-js";
import { ToneSelector } from "@/components/tone-selector";
import { ProWaitlistModal } from "@/components/pro-waitlist-modal";

const LOADING_MESSAGES = [
  "Analyzing your poor life choices...",
  "Counting your regrets...",
  "Consulting the council of disappointment...",
  "Almost done judging you...",
];

const BASE_QUESTIONS = [
  {
    key: "phoneHours" as const,
    label: "How many hours a day are you glued to your phone, pretending to be productive?",
    emoji: "📱",
    type: "number" as const,
    min: 1,
    max: 20,
    placeholder: "8",
  },
  {
    key: "worstApp" as const,
    label: "Which app is currently winning the battle for your soul?",
    emoji: "🎭",
    type: "text" as const,
    placeholder: "TikTok, Instagram…",
  },
  {
    key: "sleepHours" as const,
    label: "How many hours of sleep are you sacrificing for absolutely no reason?",
    emoji: "😴",
    type: "number" as const,
    min: 1,
    max: 12,
    placeholder: "6",
  },
  {
    key: "foodDeliverySpend" as const,
    label: "How much money do you throw at food delivery because cooking is apparently impossible?",
    emoji: "💸",
    type: "number" as const,
    min: 0,
    placeholder: "75",
  },
  {
    key: "neverDoThing" as const,
    label: "What's your biggest broken promise to yourself?",
    emoji: "🤥",
    type: "text" as const,
    placeholder: "Go to the gym, read more…",
  },
];

const PRO_QUESTIONS = [
  {
    key: "socialMediaHours" as const,
    label: "How many hours do you doomscroll social media daily?",
    emoji: "👀",
    type: "number" as const,
    min: 0,
    max: 20,
    placeholder: "4",
  },
  {
    key: "workoutFrequency" as const,
    label: "How many times did you actually move your body this week?",
    emoji: "🏃",
    type: "number" as const,
    min: 0,
    max: 14,
    placeholder: "0",
  },
];

type Step = number | "tone" | "loading" | "followup";

const inputClass =
  "w-full rounded-xl border-2 border-neutral-800 bg-[#141414] px-5 py-4 text-xl text-[#FAFAFA] outline-none ring-[#FF3D00] focus:ring-2 transition-all";

const labelClass =
  "text-2xl sm:text-3xl font-bold leading-relaxed text-[#FAFAFA] break-words whitespace-normal text-center";

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [loadingMsgIndex, setLoadingMsgIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [selectedTone, setSelectedTone] = useState<RoastTone>("normal");
  const [showProWaitlistModal, setShowProWaitlistModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [previousAnswers, setPreviousAnswers] = useState<OnboardingAnswers | null>(null);
  const [isCheckingReturning, setIsCheckingReturning] = useState(true);

  useEffect(() => {
    posthog.capture('onboarding_started');
    // Check if user is pro and if they're a returning user
    Promise.all([
      fetch('/api/user/tier').then(res => res.json()),
      fetch('/api/user/previous-answers').then(res => res.json()),
    ])
      .then(([tierData, answersData]) => {
        setIsPro(tierData.tier === 'pro');
        if (answersData.isReturning) {
          setIsReturningUser(true);
          setPreviousAnswers(answersData.answers);
          setStep("tone");
        }
      })
      .catch(() => {
        setIsPro(false);
      })
      .finally(() => {
        setIsCheckingReturning(false);
      });
  }, []);

  const [phoneHours, setPhoneHours] = useState("");
  const [worstApp, setWorstApp] = useState("");
  const [sleepHours, setSleepHours] = useState("");
  const [foodDeliverySpend, setFoodDeliverySpend] = useState("");
  const [neverDoThing, setNeverDoThing] = useState("");
  const [socialMediaHours, setSocialMediaHours] = useState("");
  const [workoutFrequency, setWorkoutFrequency] = useState("");

  const allQuestions = [...BASE_QUESTIONS, ...(isPro ? PRO_QUESTIONS : [])];

  const values: Record<string, string> = {
    phoneHours,
    worstApp,
    sleepHours,
    foodDeliverySpend,
    neverDoThing,
    socialMediaHours,
    workoutFrequency,
  };

  const setters: Record<string, (v: string) => void> = {
    phoneHours: setPhoneHours,
    worstApp: setWorstApp,
    sleepHours: setSleepHours,
    foodDeliverySpend: setFoodDeliverySpend,
    neverDoThing: setNeverDoThing,
    socialMediaHours: setSocialMediaHours,
    workoutFrequency: setWorkoutFrequency,
  };

  function validateStep(index: number): boolean {
    const q = allQuestions[index];
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
    // If returning user, use previous answers
    if (isReturningUser && previousAnswers) {
      return previousAnswers;
    }

    const answers: OnboardingAnswers = {
      phoneHours: Number(phoneHours),
      worstApp: worstApp.trim(),
      sleepHours: Number(sleepHours),
      foodDeliverySpend: Number(foodDeliverySpend),
      neverDoThing: neverDoThing.trim(),
    };

    if (isPro) {
      answers.socialMediaHours = Number(socialMediaHours);
      answers.workoutFrequency = Number(workoutFrequency);
    }

    return answers;
  }

  const generateRoast = useCallback(async () => {
    setError(null);
    setIsGenerating(true);

    // Show loading state only after a delay to avoid flash for immediate errors
    const loadingTimeout = setTimeout(() => {
      setStep("loading");
      setLoadingMsgIndex(0);
    }, 500);

    const res = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...buildAnswers(),
        tone: selectedTone,
        mode: "roast",
        persona: "default",
        followUpAnswer: followUpAnswer || undefined,
      }),
    });

    clearTimeout(loadingTimeout);

    const data = (await res.json()) as { id?: string; error?: string; followUpQuestion?: string; requiresFollowUp?: boolean };
    const roastId =
      typeof data.id === "string" ? data.id.trim() : String(data.id ?? "");

    // Check if follow-up question is required
    if (data.requiresFollowUp && data.followUpQuestion) {
      setFollowUpQuestion(data.followUpQuestion);
      setStep("followup");
      setIsGenerating(false);
      return;
    }

    if (!res.ok || !roastId) {
      console.error("[onboarding] roast API failed:", res.status, data);
      setIsGenerating(false);

      // Check if it's a daily limit error
      if (res.status === 429 && data.error?.includes("free roast today")) {
        setShowProWaitlistModal(true);
        return;
      }

      setError(data.error ?? "Something went wrong. Try again.");
      setStep(allQuestions.length - 1);
      return;
    }

    posthog.capture('roast_generated');
    router.push(`/roast/${encodeURIComponent(roastId)}`);
    router.refresh();
  }, [phoneHours, worstApp, sleepHours, foodDeliverySpend, neverDoThing, socialMediaHours, workoutFrequency, selectedTone, isPro, router, allQuestions]);

  useEffect(() => {
    if (step !== "loading") return;
    const interval = setInterval(() => {
      setLoadingMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [step]);

  function onNext() {
    if (typeof step !== "number") return;
    if (!validateStep(step)) {
      setError("Fill in a valid answer to continue.");
      return;
    }
    setError(null);
    if (step < allQuestions.length - 1) {
      setStep(step + 1);
    } else {
      setStep("tone");
    }
  }

  function onBack() {
    if (typeof step !== "number" || step === 0) return;
    setError(null);
    setStep(step - 1);
  }

  function onToneSelect(tone: RoastTone) {
    setSelectedTone(tone);
    void generateRoast();
  }

  function onFollowUpSubmit() {
    if (!followUpAnswer.trim()) return;
    void generateRoast();
  }

  if (isCheckingReturning) {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#FF3D00] border-t-transparent" />
        <p className="text-lg text-[#FAFAFA] animate-pulse">
          Checking your profile...
        </p>
      </div>
    );
  }

  if (step === "followup") {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl text-center">
          <div className="text-9xl mb-8">🔥</div>
          <h2 className="text-3xl sm:text-4xl font-bold text-[#FAFAFA] mb-6">
            One more thing...
          </h2>
          <p className="text-xl text-neutral-300 mb-8">
            {followUpQuestion}
          </p>
          <textarea
            rows={3}
            placeholder="Your answer..."
            value={followUpAnswer}
            onChange={(e) => setFollowUpAnswer(e.target.value)}
            className={`${inputClass} resize-y min-h-[6rem] mb-6`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onFollowUpSubmit();
              }
            }}
          />
          <button
            onClick={onFollowUpSubmit}
            disabled={!followUpAnswer.trim()}
            className="w-full rounded-xl bg-[#FF3D00] px-8 py-4 text-xl font-semibold text-white shadow-[0_0_32px_rgba(255,61,0,0.35)] transition hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Get Roasted →
          </button>
        </div>
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-[#FF3D00] border-t-transparent" />
        <p className="text-lg text-[#FAFAFA] animate-pulse">
          {LOADING_MESSAGES[loadingMsgIndex]}
        </p>
        {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
      </div>
    );
  }

  if (step === "tone") {
    return (
      <>
        <ToneSelector
          onSelect={onToneSelect}
          isPro={isPro}
          onUpgradeRequest={() => setShowProWaitlistModal(true)}
        />
        <ProWaitlistModal
          isOpen={showProWaitlistModal}
          onClose={() => setShowProWaitlistModal(false)}
        />
      </>
    );
  }

  const slideIndex = typeof step === "number" ? step : 0;
  const q = allQuestions[slideIndex];

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {allQuestions.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-8 rounded-full transition-all ${
                i === slideIndex ? "bg-[#FF3D00] scale-110" : i < slideIndex ? "bg-[#FF3D00]/50" : "bg-neutral-800"
              }`}
            />
          ))}
        </div>

        {/* Question card */}
        <div
          key={q.key}
          className="flex flex-col items-center gap-8 text-center transition-opacity duration-300"
        >
          {/* Big emoji */}
          <div className="text-9xl animate-bounce" style={{ animationDuration: "2s" }}>
            {q.emoji}
          </div>

          {/* Question */}
          <label className="flex w-full flex-col gap-6">
            <span className={labelClass}>{q.label}</span>
            
            {/* Input */}
            {q.type === "text" ? (
              <textarea
                rows={2}
                placeholder={q.placeholder}
                value={values[q.key]}
                onChange={(e) => setters[q.key](e.target.value)}
                className={`${inputClass} resize-y min-h-[4rem]`}
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

        {error ? <p className="mt-4 text-center text-sm text-red-300">{error}</p> : null}

        {/* Navigation buttons */}
        <div className="mt-12 flex justify-center gap-4">
          {slideIndex > 0 ? (
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl border border-neutral-700 px-8 py-4 text-lg font-medium text-neutral-300 transition hover:border-neutral-500 hover:bg-neutral-900"
            >
              ← Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onNext}
            className="rounded-xl bg-[#FF3D00] px-8 py-4 text-lg font-medium text-white transition hover:brightness-110 hover:scale-105"
          >
            {slideIndex === allQuestions.length - 1 ? "Choose Tone →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
