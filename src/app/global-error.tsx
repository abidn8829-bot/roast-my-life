"use client";

// Last-resort page for an error in the root layout. It REPLACES the layout, so it brings its own <html> and <body>
// and none of the app's CSS or fonts are loaded: the journal look is written out here with plain values
// (powder mist #dce6ee, ink green #293a35, Georgia italic for the heading). The error itself is never shown.

const INK = "#293a35";
const MIST = "#dce6ee";
const CLAY = "#c99d85";

const css = `
  .ge-btn { display:inline-flex; align-items:center; justify-content:center; width:100%; height:56px; border-radius:12px; font-size:16px; font-weight:500; font-family:inherit; text-decoration:none; cursor:pointer; box-sizing:border-box; }
  .ge-btn:hover { opacity:.9; }
  .ge-btn:focus-visible { outline:2px solid ${INK}; outline-offset:4px; }
`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: MIST, color: INK, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <style>{css}</style>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 16px", boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: 352, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true" focusable="false" style={{ marginBottom: 24 }}>
              <path d="M42 17 C 35 9, 23 8, 16 16 C 9 24, 11 38, 20 44 C 29 50, 43 46, 47 34" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M39.7 39.3 L47 34 L49.5 42.7" stroke={CLAY} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1 style={{ margin: "0 0 32px", fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 500, fontSize: 28, lineHeight: 1.3 }}>
              Something went wrong. Try again.
            </h1>
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
              <button type="button" onClick={() => reset()} className="ge-btn" style={{ background: INK, color: MIST, border: "none" }}>
                Try again
              </button>
              {/* A plain link on purpose: the app's router may be what failed, and <Link> needs it. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="ge-btn" style={{ background: "transparent", color: INK, border: "1px solid rgba(41, 58, 53, 0.28)" }}>
                Go Home
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
