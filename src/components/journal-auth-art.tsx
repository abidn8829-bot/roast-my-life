import type { CSSProperties } from "react";

/**
 * Decorative doodle for the login / signup pages: someone happily using Ember.
 * Same hand-drawn style as the landing page: ink outline plus an offset soft-colour "print"
 * shadow, no text, no gradients. Motion lives in globals.css (.jl-a-*) and is switched off
 * under prefers-reduced-motion, which leaves the static pose. Purely decorative (aria-hidden).
 */

const INK = "var(--text)";
const line = { stroke: INK, strokeLinejoin: "round", strokeLinecap: "round", fill: "none" } as const;

const STAR = "M24 5 L29 18 L43 19 L32 28 L36 42 L24 34 L12 42 L16 28 L5 19 L19 18 Z";
const FLAME = "M24 6 C 28 14, 38 18, 36 30 C 35 38, 29 43, 23 43 C 15 43, 10 37, 11 29 C 12 23, 16 20, 18 14 C 20 18, 22 18, 24 6 Z";

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

function Sparkle({ x, y, size, wait }: { x: number; y: number; size: number; wait: number }) {
  const k = size / 48;
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`}>
      <g className="jl-a-twinkle" style={delay(wait)}>
        <path d={STAR} fill="var(--milestone)" transform="translate(2 2)" />
        <path d={STAR} {...line} strokeWidth={1.6 / k} />
      </g>
    </g>
  );
}

// Mini "graph" on the laptop screen: 0 powder, 1 sage, 2 deep sage, "t" = today (dashed, empty).
const GRID: (0 | 1 | 2 | "t")[][] = [
  [1, 2, 0, 2, 1],
  [2, 1, 1, 0, 2],
  [0, 2, 2, 1, 1],
  [2, 1, 2, 2, "t"],
];
const SHADE = ["var(--powder)", "var(--sage)", "var(--progress)"];

export function JournalAuthArt() {
  return (
    <svg
      className="jl-art h-auto w-full"
      viewBox="0 0 560 460"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* Same dotted circle as the landing hero */}
      <g transform="translate(21 10) scale(1.1)">
        <path
          d="M232 14 C 330 -4, 438 58, 452 168 C 466 270, 396 372, 286 388 C 178 404, 62 360, 28 258 C -6 154, 70 36, 232 14 Z"
          fill="var(--surface)"
        />
        <path
          d="M236 26 C 326 10, 428 66, 440 168 C 452 262, 388 360, 286 374 C 184 388, 76 348, 44 254 C 14 160, 84 44, 236 26 Z"
          stroke={INK}
          strokeWidth="1.2"
          strokeDasharray="2 7"
          strokeLinecap="round"
        />
      </g>

      <g transform="translate(0 -58)">
        {/* Sparkles */}
        <Sparkle x={140} y={188} size={30} wait={0} />
        <Sparkle x={262} y={160} size={20} wait={0.9} />
        <Sparkle x={92} y={288} size={18} wait={1.6} />
        <Sparkle x={452} y={292} size={22} wait={0.5} />

        {/* Desk */}
        <path d="M150 392 L146 412 M416 392 L420 412" {...line} strokeWidth="2" />
        <rect x="130" y="378" width="306" height="14" rx="4" fill="var(--clay)" />
        <rect x="130" y="378" width="306" height="14" rx="4" {...line} strokeWidth="1.9" />

        {/* Mug with steam */}
        <rect x="140" y="352" width="24" height="26" rx="5" fill="var(--powder)" transform="translate(2.4 2.4)" />
        <rect x="140" y="352" width="24" height="26" rx="5" {...line} strokeWidth="1.9" />
        <path d="M164 358 C176 358 176 372 164 372" {...line} strokeWidth="1.9" />
        <path className="jl-a-steam" d="M147 346 C143 338 153 334 149 326" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" />
        <path className="jl-a-steam" style={delay(1.2)} d="M157 346 C153 338 163 334 159 326" stroke="var(--clay)" strokeWidth="2" strokeLinecap="round" />

        {/* Person: torso */}
        <path
          d="M190 378 C186 342 188 314 206 302 C224 292 246 292 264 302 C282 314 284 342 280 378 Z"
          fill="var(--sage)"
          transform="translate(2.4 2.4)"
        />
        <path d="M190 378 C186 342 188 314 206 302 C224 292 246 292 264 302 C282 314 284 342 280 378 Z" {...line} strokeWidth="1.9" />
        <path d="M226 280 L226 296 M244 280 L244 296" {...line} strokeWidth="1.9" />

        {/* Waving arm (left): turns around the shoulder */}
        <g className="jl-a-wave">
          <path d="M204 316 C180 308 164 290 158 266" {...line} strokeWidth="20" />
          <path d="M204 316 C180 308 164 290 158 266" stroke="var(--sage)" strokeWidth="16" strokeLinecap="round" />
          <circle cx="156" cy="256" r="9" fill="var(--clay)" stroke={INK} strokeWidth="1.8" />
          <path d="M150 247 L146 238 M156 246 L155 236 M162 247 L165 238" {...line} strokeWidth="1.8" />
        </g>

        {/* Head: bobs gently */}
        <g className="jl-a-bob">
          <circle cx="235" cy="248" r="34" fill="var(--clay)" transform="translate(2.4 2.4)" />
          <circle cx="235" cy="248" r="34" fill="var(--surface)" stroke={INK} strokeWidth="1.9" />
          <path
            d="M201 244 C198 220 216 208 238 208 C260 208 274 224 269 244 C260 232 246 226 232 228 C218 230 208 236 201 244 Z"
            fill={INK}
            stroke={INK}
            strokeWidth="1.9"
            strokeLinejoin="round"
          />
          <path d="M236 208 C232 198 244 192 250 200" {...line} strokeWidth="1.9" />
          {/* happy closed eyes, open smile, blush */}
          <path d="M217 252 Q223 243 229 252 M241 252 Q247 243 253 252" {...line} strokeWidth="2" />
          <path d="M222 263 Q235 281 248 263 Z" fill="var(--surface)" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
          <ellipse cx="211" cy="264" rx="6" ry="4" fill="var(--clay)" opacity="0.75" />
          <ellipse cx="259" cy="264" rx="6" ry="4" fill="var(--clay)" opacity="0.75" />
        </g>

        {/* Laptop showing Ember's graph filling in */}
        <path d="M292 378 L434 378 L430 366 L296 366 Z" fill="var(--powder)" transform="translate(2.4 2.4)" />
        <path d="M292 378 L434 378 L430 366 L296 366 Z" {...line} strokeWidth="1.9" />
        <rect x="304" y="262" width="120" height="102" rx="8" fill="var(--powder)" transform="translate(2.4 2.4)" />
        <rect x="304" y="262" width="120" height="102" rx="8" fill="var(--surface)" stroke={INK} strokeWidth="1.9" strokeLinejoin="round" />
        {GRID.flatMap((row, r) =>
          row.map((v, c) => {
            const x = 316 + c * 20;
            const y = 275 + r * 20;
            if (v === "t") {
              return (
                <rect key={`${r}-${c}`} x={x} y={y} width="16" height="16" rx="3" stroke={INK} strokeWidth="1.3" strokeDasharray="3 3" />
              );
            }
            return (
              <rect
                key={`${r}-${c}`}
                className="jl-a-cell"
                style={delay((r * 5 + c) * 0.3)}
                x={x}
                y={y}
                width="16"
                height="16"
                rx="3"
                fill={SHADE[v]}
              />
            );
          }),
        )}

        {/* Typing arm (right) and hand */}
        <path d="M268 314 C292 322 308 338 318 356" {...line} strokeWidth="20" />
        <path d="M268 314 C292 322 308 338 318 356" stroke="var(--sage)" strokeWidth="16" strokeLinecap="round" />
        <g className="jl-a-type">
          <circle cx="322" cy="360" r="8" fill="var(--clay)" stroke={INK} strokeWidth="1.8" />
        </g>

        {/* A check mark that draws itself, and the floating flame */}
        <path className="jl-a-check" pathLength={60} d="M312 234 L324 246 L346 220" {...line} strokeWidth="2.6" />
        <g transform="translate(392 196) scale(1.2)">
          <g className="jl-a-float">
            <path d={FLAME} fill="var(--milestone)" transform="translate(3 3)" />
            <path d={FLAME} {...line} strokeWidth="1.7" />
            <path
              d="M23 40 C 19 40, 17 36, 19 32 C 21 29, 23 28, 24 24 C 27 29, 29 32, 28 36 C 27 39, 25 40, 23 40 Z"
              {...line}
              strokeWidth="1.4"
            />
          </g>
        </g>
      </g>
    </svg>
  );
}
