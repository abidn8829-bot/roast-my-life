import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("x-gumroad-signature");
    
    if (!signature) {
      console.error("[gumroad webhook] Missing signature");
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.GUMROAD_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[gumroad webhook] Missing GUMROAD_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("[gumroad webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const data = JSON.parse(body);
    
    // Check if this is a sale event
    if (data.event !== "sale") {
      console.log("[gumroad webhook] Ignoring non-sale event:", data.event);
      return NextResponse.json({ success: true });
    }

    const email = data.purchase?.email;
    if (!email) {
      console.error("[gumroad webhook] No email in purchase data");
      return NextResponse.json({ error: "No email in purchase" }, { status: 400 });
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

    console.log("[gumroad webhook] Successfully upgraded user to pro:", email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[gumroad webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
