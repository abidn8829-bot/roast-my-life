"use client";

import { useState } from "react";
import type { RoastTone } from "@/lib/roast-types";

type Props = {
  onSelect: (tone: RoastTone) => void;
  isPro: boolean;
  onUpgradeRequest?: () => void;
};

const TONES: { key: RoastTone; label: string; emoji: string; description: string; proOnly: boolean }[] = [
  {
    key: "normal",
    label: "Normal",
    emoji: "🔥",
    description: "Honest and funny",
    proOnly: false,
  },
  {
    key: "no_mercy",
    label: "No Mercy",
    emoji: "💀",
    description: "Extremely brutal, no filter",
    proOnly: true,
  },
  {
    key: "destroy_me",
    label: "Destroy Me",
    emoji: "☠️",
    description: "Absolutely savage, existential crisis level",
    proOnly: true,
  },
];

export function ToneSelector({ onSelect, isPro, onUpgradeRequest }: Props) {
  const [selected, setSelected] = useState<RoastTone>("normal");

  function handleSelect(tone: RoastTone) {
    if (!isPro && tone !== "normal") {
      onUpgradeRequest?.();
      return;
    }
    setSelected(tone);
    onSelect(tone);
  }

  return (
    <div className="w-full max-w-md">
      <h2 className="mb-2 text-xl font-bold text-[#FAFAFA]">Choose your roast intensity</h2>
      <p className="mb-6 text-sm text-neutral-400">
        {isPro 
          ? "Select how brutal you want your roast to be" 
          : "Normal tone is available for free users. Upgrade to Pro for more intensity!"}
      </p>

      <div className="grid gap-4">
        {TONES.map((tone) => (
          <button
            key={tone.key}
            type="button"
            onClick={() => handleSelect(tone.key)}
            disabled={!isPro && tone.proOnly}
            className={`relative rounded-2xl border-2 p-6 text-left transition-all ${
              selected === tone.key
                ? "border-[#FF3D00] bg-[#FF3D00]/10"
                : "border-neutral-800 bg-[#141414] hover:border-neutral-700"
            } ${!isPro && tone.proOnly ? "opacity-60" : ""}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-4xl">{tone.emoji}</span>
                <div>
                  <p className="text-lg font-bold text-[#FAFAFA]">{tone.label}</p>
                  <p className="text-sm text-neutral-400">{tone.description}</p>
                </div>
              </div>
              {tone.proOnly && !isPro && (
                <div className="flex flex-col items-center gap-1">
                  <span className="text-2xl">🔒</span>
                  <span className="text-xs font-semibold text-[#FF3D00]">Pro only</span>
                </div>
              )}
              {selected === tone.key && (
                <span className="absolute right-6 top-1/2 -translate-y-1/2 text-2xl text-[#FF3D00]">
                  ✓
                </span>
              )}
            </div>
          </button>
        ))}
      </div>

      {!isPro && (
        <p className="mt-6 text-center text-sm text-neutral-500">
          Upgrade to Pro to unlock No Mercy and Destroy Me tones 🔥
        </p>
      )}
    </div>
  );
}
