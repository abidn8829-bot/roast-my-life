import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { error } = await supabase
      .from("pro_waitlist")
      .insert({ email });

    if (error) {
      if (error.code === "23505") {
        // Unique violation - email already on waitlist
        return NextResponse.json({ 
          success: true, 
          message: "You're already on the list! We'll email you when Pro launches 🔥" 
        });
      }
      console.error("[pro-waitlist] Error inserting email:", error);
      return NextResponse.json({ error: "Failed to join waitlist" }, { status: 500 });
    }

    // Send notification email
    try {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
      const signupTime = new Date().toLocaleString();

      await resend.emails.send({
        from: fromEmail,
        to: "abidn8829@gmail.com",
        subject: "New Pro Waitlist Signup 🔥",
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>New Pro Waitlist Signup 🔥</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
              <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <h1 style="color: #FF3D00; font-size: 32px; font-weight: bold; margin-bottom: 20px;">
                  New Pro Waitlist Signup 🔥
                </h1>
                <div style="background-color: #141414; border: 1px solid #262626; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                  <p style="color: #FAFAFA; font-size: 16px; margin: 0 0 10px 0;">
                    <strong>Email:</strong> ${email}
                  </p>
                  <p style="color: #FAFAFA; font-size: 16px; margin: 0;">
                    <strong>Signup Time:</strong> ${signupTime}
                  </p>
                </div>
                <p style="color: #666; font-size: 14px;">
                  Someone just joined the Pro waitlist!
                </p>
              </div>
            </body>
          </html>
        `,
      });
      console.log("[pro-waitlist] Notification email sent to abidn8829@gmail.com");
    } catch (emailError) {
      console.error("[pro-waitlist] Failed to send notification email:", emailError);
      // Don't fail the request if email fails, just log it
    }

    return NextResponse.json({ 
      success: true, 
      message: "You're on the list! We'll email you when Pro launches 🔥" 
    });
  } catch (error) {
    console.error("[pro-waitlist] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
