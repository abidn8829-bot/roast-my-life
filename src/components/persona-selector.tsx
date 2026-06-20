"use client";

import type { RoastPersona } from "@/lib/roast-types";

type Props = {
  onSelect: (persona: RoastPersona) => void;
  isPro: boolean;
  onUpgradeRequest: () => void;
};

const PERSONAS: { id: RoastPersona; name: string; emoji: string; description: string }[] = [
  { id: "default", name: "Default", emoji: "🔥", description: "Savage roast comedian" },
  { id: "gordon_ramsay", name: "Gordon Ramsay", emoji: "👨‍🍳", description: "Screaming chef energy" },
  { id: "drill_sergeant", name: "Drill Sergeant", emoji: "🎖️", description: "Brutal discipline" },
  { id: "toxic_friend", name: "Toxic Best Friend", emoji: "💅", description: "Savage but loving" },
  { id: "corporate_manager", name: "Corporate Manager", emoji: "💼", description: "Performance review style" },
  { id: "savage_grandma", name: "Savage Grandma", emoji: "👵", description: "Disappointed but funny" },
];

export function PersonaSelector({ onSelect, isPro, onUpgradeRequest }: Props) {
  return (
    <div className="w-full max-w-md">
      <h2 className="mb-6 text-center text-2xl font-bold text-[#FAFAFA]">Choose your persona</h2>
      <div className="grid grid-cols-2 gap-3">
        {PERSONAS.map((persona) => (
          <button
            key={persona.id}
            type="button"
            onClick={() => (isPro || persona.id === "default" ? onSelect(persona.id) : onUpgradeRequest())}
            disabled={!isPro && persona.id !== "default"}
            className={`rounded-xl border-2 px-4 py-4 text-center transition ${
              isPro || persona.id === "default"
                ? "border-[#FF3D00] bg-[#FF3D00]/10 hover:bg-[#FF3D00]/20"
                : "border-neutral-800 bg-neutral-900 opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="text-4xl mb-2">{persona.emoji}</div>
            <div className="text-sm font-bold text-[#FAFAFA]">{persona.name}</div>
            <div className="text-xs text-neutral-400 mt-1">
              {isPro || persona.id === "default" ? persona.description : "Pro only 🔒"}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
