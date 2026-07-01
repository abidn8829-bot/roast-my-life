import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    return NextResponse.json({ 
      success: true, 
      message: "You're on the list! We'll email you when Pro launches 🔥" 
    });
  } catch (error) {
    console.error("[pro-waitlist] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
