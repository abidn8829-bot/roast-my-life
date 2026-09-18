import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import "./globals.css";
import { PostHogProvider } from "@/components/PostHogProvider";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ember — Get Brutally Roasted by AI",
  description: "Answer 5 questions. Get brutally roasted by AI. Share your shame.",
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
