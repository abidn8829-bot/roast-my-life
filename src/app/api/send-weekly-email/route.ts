import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!authHeader || !authHeader.startsWith("Bearer ") || authHeader.slice(7) !== cronSecret) {
    console.error("[send-weekly-email] Unauthorized request");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    
    // Get all users from Supabase auth
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

    // Send email to each user
    const emailPromises = users.map(async (user) => {
      if (!user.email) return;

      try {
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: "Your weekly roast is ready 🔥",
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Your weekly roast is ready 🔥</title>
              </head>
              <body style="margin: 0; padding: 0; background-color: #0A0A0A; font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                  <h1 style="color: #FF3D00; font-size: 32px; font-weight: bold; margin-bottom: 20px;">
                    EMBER
                  </h1>
                  <p style="color: #FAFAFA; font-size: 18px; line-height: 1.6; margin-bottom: 30px;">
                    Another week, another chance to disappoint yourself. Come get roasted.
                  </p>
                  <div style="text-align: center; margin: 40px 0;">
                    <a href="${appUrl}/onboarding" 
                       style="display: inline-block; background-color: #FF3D00; color: white; padding: 16px 32px; text-decoration: none; font-size: 18px; font-weight: bold; border-radius: 8px;">
                      GET ROASTED →
                    </a>
                  </div>
                  <p style="color: #666; font-size: 14px; margin-top: 40px;">
                    You're receiving this because you signed up for Ember.
                  </p>
                </div>
              </body>
            </html>
          `,
        });
      } catch (error) {
        console.error(`Failed to send email to ${user.email}:`, error);
      }
    });

    await Promise.all(emailPromises);

    return NextResponse.json({ 
      success: true, 
      message: `Sent emails to ${users.length} users` 
    });
  } catch (error) {
    console.error("Error in send-weekly-email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
