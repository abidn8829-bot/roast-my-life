import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-10 text-[#FAFAFA]">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="mb-8 inline-block text-sm font-semibold text-[#FF3D00] hover:underline"
        >
          ← Back to Home
        </Link>

        <h1 className="text-4xl font-black mb-8">Privacy Policy</h1>

        <div className="space-y-6 text-neutral-300">
          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Data Collection</h2>
            <p className="leading-relaxed">
              We collect the information you provide during the onboarding process, including your phone usage, screen time, sleep habits, spending patterns, and productivity data. We also collect your email address for authentication purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">How We Use Your Data</h2>
            <p className="leading-relaxed">
              Your data is used solely to generate personalized roasts and report cards. We use AI to analyze your responses and create content. We do not sell your data to third parties or use it for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Data Storage</h2>
            <p className="leading-relaxed">
              Your data is stored securely in our database. We do not store any uploaded files after processing. Your roast history is retained in your account for your personal reference.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Data Deletion</h2>
            <p className="leading-relaxed">
              You can request deletion of your account and all associated data at any time. Contact us through your account settings or email support for assistance.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Third-Party Services</h2>
            <p className="leading-relaxed">
              We use Supabase for authentication and database storage, and Groq for AI-powered roast generation. These services have their own privacy policies and data handling practices.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Cookies</h2>
            <p className="leading-relaxed">
              We use essential cookies for authentication and session management. We also use analytics cookies to understand how you use our app and improve our services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Changes to This Policy</h2>
            <p className="leading-relaxed">
              We may update this privacy policy from time to time. We will notify you of any significant changes by posting the new policy on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#FAFAFA] mb-3">Contact Us</h2>
            <p className="leading-relaxed">
              If you have any questions about this privacy policy, please contact us through our support channels.
            </p>
          </section>
        </div>

        <p className="mt-12 text-sm text-neutral-500">
          Last updated: June 2026
        </p>
      </div>
    </main>
  );
}
