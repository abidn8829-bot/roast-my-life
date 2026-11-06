"use client";

import { FREE_PERSONA, ROAST_PERSONA_LIST } from "@/lib/roast-personas";
import type { RoastPersona } from "@/lib/roast-types";

type Props = {
  onSelect: (persona: RoastPersona) => void;
  isPro: boolean;
  onUpgradeRequest: () => void;
};

// Names, icons and blurbs come from src/lib/roast-personas.ts (the only place they are written).
const PERSONAS = ROAST_PERSONA_LIST.map((p) => ({ id: p.id, name: p.label, emoji: p.emoji, description: p.blurb }));

export function PersonaSelector({ onSelect, isPro, onUpgradeRequest }: Props) {
  return (
    <div className="w-full max-w-md">
      <h2 className="mb-6 text-center text-2xl font-bold text-text-legacy">Choose your persona</h2>
      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => (isPro || persona.id === FREE_PERSONA ? onSelect(persona.id) : onUpgradeRequest())}
            disabled={!isPro && persona.id !== FREE_PERSONA}
            className={`rounded-xl border-2 px-4 py-4 text-center transition ${
              isPro || persona.id === FREE_PERSONA
                ? "border-ember-legacy bg-ember-legacy/10 hover:bg-ember-legacy/20"
                : "border-line-subtle-legacy bg-surface-sunken-legacy opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="text-4xl mb-2">{persona.emoji}</div>
            <div className="text-sm font-bold text-text-legacy">{persona.name}</div>
            <div className="text-xs text-text-secondary-legacy mt-1">
              {isPro || persona.id === FREE_PERSONA ? persona.description : "Pro only 🔒"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
