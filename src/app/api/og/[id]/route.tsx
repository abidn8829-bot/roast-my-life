import { ImageResponse } from "next/og";
import { getShareCardData } from "@/lib/get-share-card";
import type { CategoryScores } from "@/lib/roast-types";

export const runtime = "nodejs";

const EMBER_ORANGE = "#FF3D00";

// Fixed order, real keys from CategoryScores.
const CATEGORY_ROWS: { key: keyof CategoryScores; label: string }[] = [
  { key: "sleep", label: "Sleep" },
  { key: "fitness", label: "Fitness" },
  { key: "discipline", label: "Discipline" },
  { key: "focus", label: "Focus" },
  { key: "spending", label: "Spending" },
];

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
      return "#3ddc84";
    case "B":
      return "#8bd450";
    case "C":
      return "#f2c94c";
    case "D":
      return "#f2994a";
    case "F":
      return "#eb5757";
    default:
      return "#eb5757";
  }
}

function getScoreColor(score: number): string {
  if (score >= 90) return "#3ddc84";
  if (score >= 75) return "#8bd450";
  if (score >= 60) return "#f2c94c";
  if (score >= 40) return "#f2994a";
  return "#eb5757";
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
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

    const { lifeScore, funnyTitle, punchline, categoryScores } = result.card;

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
            background: "#0a0a0b",
            padding: 80,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          {/* Life Score */}
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
                color: "#5f5f66",
                marginBottom: 10,
              }}
            >
              YOUR LIFE SCORE
            </span>
            <span
              style={{
                fontSize: 180,
                fontWeight: 900,
                color: getScoreColor(lifeScore),
                lineHeight: 1,
                display: "flex",
              }}
            >
              {lifeScore}
              <span style={{ fontSize: 80, color: "#5f5f66" }}>/100</span>
            </span>
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
                color: "#f5f3f0",
                textAlign: "center",
              }}
            >
              {funnyTitle}
            </span>
          </div>

          {/* Category breakdown */}
          {rows.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginBottom: 50,
              }}
            >
              {rows.map((row, i) => {
                const color = getGradeColor(row.grade);
                return (
                  <div
                    key={row.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      padding: "26px 34px",
                      marginTop: i === 0 ? 0 : 20,
                      background: "#111111",
                      border: `2px solid ${color}55`,
                      borderRadius: 18,
                    }}
                  >
                    <span
                      style={{
                        width: 220,
                        fontSize: 34,
                        fontWeight: 700,
                        color: "#f5f3f0",
                      }}
                    >
                      {row.label}
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flex: 1,
                        height: 22,
                        marginLeft: 20,
                        marginRight: 30,
                        borderRadius: 11,
                        background: "#262626",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          width: `${row.fill}%`,
                          height: "100%",
                          borderRadius: 11,
                          background: color,
                        }}
                      />
                    </div>
                    <span
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        width: 56,
                        fontSize: 56,
                        fontWeight: 900,
                        color,
                      }}
                    >
                      {row.grade}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Best Roast One-Liner */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 30,
              borderRadius: 20,
              background: "#111111",
              border: `2px solid ${EMBER_ORANGE}`,
              marginBottom: 60,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#f5f3f0",
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
                color: EMBER_ORANGE,
              }}
            >
              EMBERAI
            </span>
            <span style={{ marginTop: 10, fontSize: 26, color: "#98979c" }}>
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
