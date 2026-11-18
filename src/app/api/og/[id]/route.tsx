import { ImageResponse } from "next/og";
import { getShareCardData } from "@/lib/get-share-card";
import type { CategoryScores } from "@/lib/roast-types";

export const runtime = "nodejs";

// Journal values (see globals.css). Hard-coded because the image is drawn outside the page's CSS.
// Light card: powder mist background, ink green text. Powder (track) and bar green (fill) are fills only, never text.
const MIST = "#dce6ee";
const SURFACE = "#ecf1f6";
const INK = "#293a35";
const MUTED = "#555750";
const POWDER = "#b9c9d8";
const BAR = "#566b5b";
const HAIRLINE = "rgba(41, 58, 53, 0.28)";

// Fixed order, real keys from CategoryScores.
const CATEGORY_ROWS: { key: keyof CategoryScores; label: string }[] = [
  { key: "sleep", label: "Sleep" },
  { key: "fitness", label: "Fitness" },
  { key: "discipline", label: "Discipline" },
  { key: "focus", label: "Focus" },
  { key: "spending", label: "Spending" },
];

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

// The card font has no emoji glyphs, so next/og would fetch every emoji from a third-party CDN while drawing the image.
// The title and the punchline are the only free text on the card: strip emojis from both so that fetch never happens.
function stripEmoji(text: string): string {
  return text.replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3]/gu, "").replace(/\s+/g, " ").trim();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const result = await getShareCardData(id);
    if ("error" in result) {
      if (result.error === "not_found") {
        return new Response("Roast not found", { status: 404 });
      }
      console.error("[api/og] Supabase error:", result.message);
      return new Response(`Database error: ${result.message}`, { status: 500 });
    }

    const { lifeScore, categoryScores } = result.card;
    const funnyTitle = stripEmoji(result.card.funnyTitle) || "Your Life";
    const punchline = stripEmoji(result.card.punchline) || "Your life choices spoke for themselves.";

    const rows = categoryScores
      ? CATEGORY_ROWS.map(({ key, label }) => {
          const { score, grade } = categoryScores[key];
          return {
            key,
            label,
            grade,
            fill: Math.max(0, Math.min(100, score)),
          };
        })
      : [];

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            background: MIST,
            padding: 80,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Life Score: the number in ink, a bar that carries it */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginBottom: 30,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                letterSpacing: 4,
                color: MUTED,
                marginBottom: 10,
              }}
            >
              YOUR LIFE SCORE
            </span>
            <span
              style={{
                fontSize: 180,
                fontWeight: 900,
                color: INK,
                lineHeight: 1,
                display: "flex",
              }}
            >
              {lifeScore}
              <span style={{ fontSize: 80, color: MUTED }}>/100</span>
            </span>
            <div
              style={{
                display: "flex",
                width: 560,
                height: 26,
                marginTop: 28,
                border: `3px solid ${INK}`,
                borderRadius: 8,
                background: POWDER,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", width: `${lifeScore}%`, height: "100%", background: BAR }} />
            </div>
          </div>

          {/* Funny Title */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: 50,
            }}
          >
            <span
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: INK,
                textAlign: "center",
              }}
            >
              {funnyTitle}
            </span>
          </div>

          {/* Category breakdown: grade letter in ink, bar carries the score */}
          {rows.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: 50,
              }}
            >
              {rows.map((row, i) => (
                <div
                  key={row.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "26px 34px",
                    marginTop: i === 0 ? 0 : 20,
                    background: SURFACE,
                    border: `2px solid ${HAIRLINE}`,
                    borderRadius: 18,
                  }}
                >
                  <span
                    style={{
                      width: 220,
                      fontSize: 34,
                      fontWeight: 700,
                      color: INK,
                    }}
                  >
                    {row.label}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      width: 56,
                      fontSize: 56,
                      fontWeight: 900,
                      color: INK,
                    }}
                  >
                    {row.grade}
                  </span>
                  <div
                    style={{
                      display: "flex",
                      flex: 1,
                      height: 24,
                      marginLeft: 24,
                      border: `2px solid ${INK}`,
                      borderRadius: 7,
                      background: POWDER,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: `${row.fill}%`,
                        height: "100%",
                        background: BAR,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Best Roast One-Liner */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 30,
              borderRadius: 20,
              background: SURFACE,
              border: `2px solid ${INK}`,
              marginBottom: 60,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: INK,
                lineHeight: 1.4,
                textAlign: "center",
              }}
            >
              &quot;{truncate(punchline, 180)}&quot;
            </span>
          </div>

          {/* Wordmark */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                letterSpacing: 6,
                color: INK,
              }}
            >
              EMBERAI
            </span>
            <span style={{ marginTop: 10, fontSize: 26, color: MUTED }}>
              Get roasted at emberai.site
            </span>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
        // next/og defaults to a 1-year immutable cache, which would pin stale
        // (or old-design) cards in browsers/CDNs and social scrapers.
        headers: {
          "Cache-Control":
            "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (error) {
    console.error("[api/og] Unhandled error in OG generation:", error);
    return new Response(
      `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 },
    );
  }
}
