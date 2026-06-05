import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const LABELS = [
  { key: "screenTime", label: "Screen Time" },
  { key: "sleep", label: "Sleep" },
  { key: "spending", label: "Spending" },
  { key: "productivity", label: "Productivity" },
];

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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: roast } = await supabase
    .from("roasts")
    .select("report_card")
    .eq("id", id)
    .single();

  if (!roast) {
    return new Response("Roast not found", { status: 404 });
  }

  const card = roast.report_card ?? {};

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#0A0A0A",
          padding: 56,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 40,
          }}
        >
          <span
            style={{
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#FF3D00",
            }}
          >
            ROAST MY LIFE
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
          }}
        >
          {LABELS.map(({ key, label }) => (
            <div
              key={key}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                width: 220,
                padding: 24,
                borderRadius: 16,
                border: "2px solid #262626",
                background: "#141414",
              }}
            >
              <span style={{ fontSize: 16, color: "#a3a3a3", marginBottom: 8 }}>
                {label}
              </span>
              <span
                style={{
                  fontSize: 72,
                  fontWeight: 800,
                  color: getGradeColor(card[key] ?? "F"),
                }}
              >
                {card[key] ?? "F"}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    },
  );
}
