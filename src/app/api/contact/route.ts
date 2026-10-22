import { NextResponse } from "next/server";
import { Resend } from "resend";
import { isPakistan, ruleFloorLevel, safetyLog, supportLinesOrFallback } from "@/lib/safety";
import { safetyJson } from "@/lib/safety-response";
import { recordFlag } from "@/lib/safety-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const resend = new Resend(process.env.RESEND_API_KEY);

const CONTACT_TO_EMAIL = "abidn8829@gmail.com";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "Name, email, and message are required" },
      { status: 400 },
    );
  }

  // Safety rule filter (no AI call on this route). If the message shows sadness or risk it is
  // NOT emailed anywhere: the support page is shown instead. A flag is stored only when the
  // sender is logged in. Nothing from the message is logged.
  const ruleLevel = ruleFloorLevel(name, message);
  if (ruleLevel !== 0) {
    safetyLog(ruleLevel, "contact");
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await recordFlag(createSupabaseServiceClient(), user.id, ruleLevel);
    } catch {
      console.error("[safety] flag write failed code=contact");
    }
    return safetyJson({ kind: "page", level: ruleLevel, lines: ruleLevel === 1 ? supportLinesOrFallback(null) : [], inPakistan: isPakistan(request.headers) });
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: CONTACT_TO_EMAIL,
    replyTo: email,
    subject: `New contact form message from ${name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New contact form message</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #FF3D00; font-size: 24px; font-weight: bold; margin-bottom: 20px;">
              New contact message
            </h1>
            <p style="color: #FAFAFA; font-size: 14px; margin-bottom: 4px;"><strong>Name:</strong> ${name}</p>
            <p style="color: #FAFAFA; font-size: 14px; margin-bottom: 20px;"><strong>Email:</strong> ${email}</p>
            <p style="color: #FAFAFA; font-size: 16px; line-height: 1.6; white-space: pre-wrap;">${message}</p>
          </div>
        </body>
      </html>
    `,
  });

  if (error) {
    // Name / status only: the full error object could carry the message.
    console.error("[contact] Failed to send email via Resend:", { name: error.name, statusCode: (error as { statusCode?: number | null }).statusCode ?? null });
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
