import type { Viewport } from "next";
import Link from "next/link";
import { inkLink } from "@/components/journal-auth-ui";
import { JournalTheme } from "@/components/journal-theme";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description: "What data Ember collects, how it is used to generate your roasts and report cards, and how you can request deletion of your account.",
  path: "/privacy",
});

// Light journal theme: browser UI colour matches the page background (this page only).
export const viewport: Viewport = { themeColor: "#DCE6EE" };

export default function PrivacyPage() {
  return (
    <JournalTheme>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6 sm:px-6">
        <Link href="/" className={`${inkLink} mb-6 gap-2 text-sm`}>
          <span aria-hidden="true">←</span>
          Back to Home
        </Link>

        <h1 className="mb-10 font-display text-[clamp(2.25rem,8vw,3.25rem)] font-medium leading-[1.05] tracking-[-0.01em]">Privacy Policy</h1>

        <div className="space-y-8 text-text">
          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Data Collection</h2>
            <p className="leading-relaxed">
              We collect the information you provide during the onboarding process, including your phone usage, screen time, sleep habits, spending patterns, and productivity data. We also collect your email address for authentication purposes.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">How We Use Your Data</h2>
            <p className="leading-relaxed">
              Your data is used solely to generate personalized roasts and report cards. We use AI to analyze your responses and create content. We do not sell your data to third parties or use it for advertising purposes.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Data Storage</h2>
            <p className="leading-relaxed">
              Your data is stored securely in our database. We do not store any uploaded files after processing. Your roast history is retained in your account for your personal reference.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Data Deletion</h2>
            <p className="leading-relaxed">
              You can request deletion of your account and all associated data at any time. Contact us through your account settings or email support for assistance.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Third-Party Services</h2>
            <p className="leading-relaxed">
              We use Supabase for authentication and database storage, and Groq for AI-powered roast generation. These services have their own privacy policies and data handling practices.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Cookies</h2>
            <p className="leading-relaxed">
              We use essential cookies for authentication and session management. We also use analytics cookies to understand how you use our app and improve our services.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any significant changes by posting the new policy on this page.
            </p>
          </section>

          <section className="border-t border-border pt-8">
            <h2 className="font-display mb-3 text-[26px] font-normal leading-[1.15]">Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this privacy policy, please contact us through our support channels.
            </p>
          </section>
        </div>

        <p className="mt-12 text-sm text-text-muted">
          Last updated: June 2026
        </p>
      </main>
    </JournalTheme>
  );
}
