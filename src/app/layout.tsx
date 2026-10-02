import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/PostHogProvider";
import { OG_IMAGE } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const TITLE = "Ember — AI Accountability App That Roasts Your Habits";
const DESCRIPTION =
  "Ember is an AI accountability app for self-tracking. Get honest roasts of your habits, daily check-ins, and a Life Score that shows if you're improving.";
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s | Ember" },
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Ember",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE.url],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden`}
    >
      <body className="flex min-h-full flex-col bg-bg text-text font-sans overflow-x-hidden">
        <PostHogProvider>{children}</PostHogProvider>
      </body>
    </html>
  );
}
