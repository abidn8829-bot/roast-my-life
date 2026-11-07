"use client";

import { focusRing } from "@/components/journal-auth-ui";
import { questionTitle } from "@/components/journal-onboarding-ui";
import { FREE_PERSONA, ROAST_PERSONA_LIST } from "@/lib/roast-personas";
import type { RoastPersona } from "@/lib/roast-types";

type Props = {
  onSelect: (persona: RoastPersona) => void;
  isPro: boolean;
  onUpgradeRequest: () => void;
  /** True while a roast request is running: every card ignores taps. */
  disabled?: boolean;
};

// Names, icons and blurbs come from src/lib/roast-personas.ts (the only place they are written).
const PERSONAS = ROAST_PERSONA_LIST.map((p) => ({ id: p.id, name: p.label, emoji: p.emoji, description: p.blurb }));

// Journal look: one column of bordered rows, 14px radius, at least 56px high. The icon is not drawn on the row.
const rowBase = `flex min-h-[64px] w-full flex-col items-start justify-center rounded-[14px] border px-[18px] py-3 text-left transition ${focusRing}`;
const rowAvailable =
  "border-border-strong-legacy bg-surface text-text hover:bg-surface-2 disabled:cursor-wait disabled:hover:bg-surface";
// Locked: dimmed (no fill, lighter border) but the text stays readable.
const rowLocked = "cursor-not-allowed border-border bg-transparent text-text-muted";

export function PersonaSelector({ onSelect, isPro, onUpgradeRequest, disabled = false }: Props) {
  return (
    <div className="w-full">
      <h2 className={`${questionTitle} mb-8`}>Choose your persona</h2>
      <div className="flex flex-col gap-2.5">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => (isPro || persona.id === FREE_PERSONA ? onSelect(persona.id) : onUpgradeRequest())}
            disabled={disabled || (!isPro && persona.id !== FREE_PERSONA)}
            className={`${rowBase} ${isPro || persona.id === FREE_PERSONA ? rowAvailable : rowLocked}`}
          >
            <span className="block text-base font-medium">{persona.name}</span>
            <span className="mt-0.5 block text-sm font-light text-text-muted">
              {isPro || persona.id === FREE_PERSONA ? persona.description : "Pro only"}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
