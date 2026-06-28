import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getGradeColor(grade: string): string {
  switch (grade) {
    case "A":
    case "B":
      return "#34d399";
    case "C":
      return "#fbbf24";
    case "D":
      return "#fb923c";
    case "F":
      return "#f87171";
    default:
      return "#f87171";
  }
}

function getScoreColor(score: number): string {
  if (score <= 40) return "#ef4444";
  if (score <= 70) return "#f59e0b";
  return "#10b981";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    console.log("[api/og] Generating OG image for roastId:", id);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    // Use the RLS-bypassing function to get roast data
    const { data: roast, error } = await supabase
      .rpc("get_roast_for_og", { p_id: id });

    if (error) {
      console.error("[api/og] Supabase error:", error);
      return new Response(`Database error: ${error.message}`, { status: 500 });
    }

    if (!roast || roast.length === 0) {
      console.error("[api/og] Roast not found for id:", id);
      return new Response("Roast not found", { status: 404 });
    }

    const roastData = roast[0];
    console.log("[api/og] Roast data found:", { life_score: roastData.life_score, funny_title: roastData.funny_title, top_5_roasts: roastData.top_5_roasts, category_scores: roastData.category_scores });

    const lifeScore = roastData.life_score ?? 50;
    const funnyTitle = roastData.funny_title ?? "Your Life";
    const topRoasts = Array.isArray(roastData.top_5_roasts) && roastData.top_5_roasts.length > 0 ? roastData.top_5_roasts : ["You need to do better."];
    const categoryScores = roastData.category_scores;

    console.log("[api/og] Category scores raw:", categoryScores);

    // Find worst and best categories
    let worstCategory = { name: "Unknown", grade: "F", score: 0 };
    let bestCategory = { name: "Unknown", grade: "A", score: 100 };

    if (categoryScores && typeof categoryScores === "object" && Object.keys(categoryScores).length > 0) {
      const entries = Object.entries(categoryScores);
      console.log("[api/og] Category entries:", entries);
      for (const [name, data] of entries) {
        const categoryData = data as { score: number; grade: string };
        console.log("[api/og] Processing category:", name, categoryData);
        // Use default values if category data is empty
        const score = categoryData.score ?? 50;
        const grade = categoryData.grade ?? "C";
        if (score < worstCategory.score) {
          worstCategory = { name, grade, score };
        }
        if (score > bestCategory.score) {
          bestCategory = { name, grade, score };
        }
      }
    } else {
      console.log("[api/og] No valid category scores found, using defaults");
    }

    console.log("[api/og] Final categories:", { worst: worstCategory, best: bestCategory });

    const bestRoast = topRoasts[0] ?? "You need to do better.";

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#0A0A0A",
            padding: 60,
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
                color: "#666",
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
              <span style={{ fontSize: 80, color: "#666" }}>/100</span>
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
                color: "#FAFAFA",
                textAlign: "center",
              }}
            >
              {funnyTitle}
            </span>
          </div>

          {/* Worst and Best Categories */}
          <div
            style={{
              display: "flex",
              gap: 30,
              marginBottom: 50,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: 30,
                borderRadius: 20,
                background: "#141414",
                border: "2px solid #262626",
              }}
            >
              <span style={{ fontSize: 20, color: "#666", marginBottom: 10 }}>
                WORST
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#FAFAFA",
                  marginBottom: 10,
                }}
              >
                {worstCategory.name?.toUpperCase() ?? "UNKNOWN"}
              </span>
              <span
                style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: getGradeColor(worstCategory.grade),
                }}
              >
                {worstCategory.grade}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: 30,
                borderRadius: 20,
                background: "#141414",
                border: "2px solid #262626",
              }}
            >
              <span style={{ fontSize: 20, color: "#666", marginBottom: 10 }}>
                BEST
              </span>
              <span
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: "#FAFAFA",
                  marginBottom: 10,
                }}
              >
                {bestCategory.name?.toUpperCase() ?? "UNKNOWN"}
              </span>
              <span
                style={{
                  fontSize: 80,
                  fontWeight: 900,
                  color: getGradeColor(bestCategory.grade),
                }}
              >
                {bestCategory.grade}
              </span>
            </div>
          </div>

          {/* Best Roast One-Liner */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 30,
              borderRadius: 20,
              background: "#141414",
              border: "2px solid #FF3D00",
              marginBottom: 50,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#FAFAFA",
                lineHeight: 1.4,
              }}
            >
              "{bestRoast}"
            </span>
          </div>

          {/* App Name */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: "auto",
            }}
          >
            <span
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: 4,
                color: "#FF3D00",
              }}
            >
              ROAST MY LIFE
            </span>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1920,
      },
    );
  } catch (error) {
    console.error("[api/og] Unhandled error in OG generation:", error);
    return new Response(`Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`, { status: 500 });
  }
}
