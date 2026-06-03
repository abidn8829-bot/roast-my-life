import { ImageResponse } from "@vercel/og";
import { gradeOgColor } from "@/lib/grades";
import { getRoastByIdentifier } from "@/lib/get-roast-public";
import { extractRoastQuote } from "@/lib/roast-quote";
import type { ReportCard } from "@/lib/roast-types";
import { createClient } from "@supabase/supabase-js";

export const runtime = "edge";

const BASE_LABELS: { key: keyof ReportCard; label: string }[] = [
  { key: "screenTime", label: "Screen Time" },
  { key: "sleep", label: "Sleep" },
  { key: "spending", label: "Spending" },
  { key: "productivity", label: "Productivity" },
];

const PRO_LABELS: { key: keyof ReportCard; label: string }[] = [
  { key: "socialMedia", label: "Social Media" },
  { key: "fitness", label: "Fitness" },
];

async function getUserTier(userId: string): Promise<"free" | "pro"> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const { data } = await supabase
      .from("users")
      .select("subscription_tier")
      .eq("id", userId)
      .single();
    return data?.subscription_tier === "pro" ? "pro" : "free";
  } catch {
    return "free";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const roast = await getRoastByIdentifier(id);

  if (!roast) {
    return new Response("Roast not found", { status: 404 });
  }

  const quote = extractRoastQuote(roast.roast_text);
  const card = roast.report_card;
  const userTier = await getUserTier(roast.user_id);

  const labels = userTier === "pro" 
    ? [...BASE_LABELS, ...PRO_LABELS.filter(l => card[l.key] !== undefined)]
    : BASE_LABELS;

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
          <span style={{ fontSize: 48, marginBottom: 12 }}>🔥</span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 6,
              color: "#FF3D00",
            }}
          >
            ROAST MY LIFE
          </span>
          <span
            style={{
              fontSize: 18,
              color: "#737373",
              letterSpacing: 4,
              marginTop: 8,
            }}
          >
            WEEKLY REPORT CARD
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          {labels.map(({ key, label }) => (
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
                  color: gradeOgColor(card[key] as any),
                }}
              >
                {card[key]}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            borderLeft: "4px solid #FF3D00",
            paddingLeft: 28,
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: "#FF3D00",
              marginBottom: 16,
              letterSpacing: 2,
            }}
          >
            THEY SAID
          </span>
          <span
            style={{
              fontSize: 32,
              color: "#FAFAFA",
              lineHeight: 1.4,
              fontStyle: "italic",
            }}
          >
            &ldquo;{quote}&rdquo;
          </span>
        </div>

        {userTier === "free" && (
          <span
            style={{
              fontSize: 16,
              color: "#525252",
              textAlign: "center",
              marginTop: 32,
            }}
          >
            roastmylife.vercel.app
          </span>
        )}
      </div>
    ),
    {
      width: 1080,
      height: 1920,
    },
  );
}
