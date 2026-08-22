import { NextResponse } from "next/server";
import { Resend } from "resend";

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
    console.error("[contact] Failed to send email via Resend:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json({ success: true, id: data?.id });
}
