import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Gumroad's Ping notifications are NOT signed — there is no HMAC/signature header
// like Stripe or GitHub webhooks send. Gumroad also posts as
// application/x-www-form-urlencoded with FLAT fields (e.g. `email`, `seller_id`,
// `product_id`, `sale_id`), not JSON with nested `purchase.*` fields.
//
// Because Gumroad can't sign the request, we secure this endpoint ourselves by
// requiring a secret `token` query param on the Ping URL registered in Gumroad's
// Advanced Settings, e.g.:
//   https://your-app.com/api/webhook/gumroad?token=YOUR_GUMROAD_WEBHOOK_SECRET
// (reusing the existing GUMROAD_WEBHOOK_SECRET env var as that token's value)

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    const webhookSecret = process.env.GUMROAD_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[gumroad webhook] Missing GUMROAD_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!token || token !== webhookSecret) {
      console.error("[gumroad webhook] Missing or invalid token on Ping URL");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rawBody = await request.text();

    // Gumroad sends form-urlencoded, not JSON.
    const params = new URLSearchParams(rawBody);
    const data = Object.fromEntries(params.entries());

    console.log("[gumroad webhook] Received ping:", {
      ...data,
      email: data.email ? "[present]" : undefined,
    });

    // If registered via the resource_subscriptions API (rather than the simple
    // per-account Ping URL), Gumroad includes resource_name. The plain Ping URL
    // only ever fires for sales, so this check is a no-op in that case.
    if (data.resource_name && data.resource_name !== "sale") {
      return NextResponse.json({ success: true });
    }

    const email = data.email;
    if (!email) {
      console.error("[gumroad webhook] No email in ping payload:", data);
      return NextResponse.json({ error: "No email in payload" }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Update user's subscription tier to pro
    const { error } = await supabase
      .from("users")
      .update({ subscription_tier: "pro" })
      .eq("email", email);

    if (error) {
      console.error("[gumroad webhook] Failed to update user:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[gumroad webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}