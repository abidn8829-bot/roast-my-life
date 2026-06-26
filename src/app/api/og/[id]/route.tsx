import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

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
  const { id } = await params;
  console.log("[api/og] Generating OG image for roastId:", id);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: roast, error } = await supabase
    .from("roasts")
    .select("life_score, funny_title, top_5_roasts, category_scores")
    .eq("id", id)
    .single();

  if (error) {
    console.error("[api/og] Supabase error:", error);
    return new Response(`Database error: ${error.message}`, { status: 500 });
  }

  if (!roast) {
    console.error("[api/og] Roast not found for id:", id);
    return new Response("Roast not found", { status: 404 });
  }

  console.log("[api/og] Roast data found:", { life_score: roast.life_score, funny_title: roast.funny_title, top_5_roasts: roast.top_5_roasts, category_scores: roast.category_scores });

  const lifeScore = roast.life_score ?? 50;
  const funnyTitle = roast.funny_title ?? "Your Life";
  const topRoasts = roast.top_5_roasts ?? ["You need to do better."];
  const categoryScores = roast.category_scores;

  // Find worst and best categories
  let worstCategory = { name: "Unknown", grade: "F", score: 0 };
  let bestCategory = { name: "Unknown", grade: "A", score: 100 };

  if (categoryScores) {
    const entries = Object.entries(categoryScores);
    for (const [name, data] of entries) {
      const categoryData = data as { score: number; grade: string };
      if (categoryData.score < worstCategory.score) {
        worstCategory = { name, grade: categoryData.grade, score: categoryData.score };
      }
      if (categoryData.score > bestCategory.score) {
        bestCategory = { name, grade: categoryData.grade, score: categoryData.score };
      }
    }
  }

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
              {worstCategory.name.toUpperCase()}
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
              {bestCategory.name.toUpperCase()}
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
            "{topRoasts[0]}"
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
}
