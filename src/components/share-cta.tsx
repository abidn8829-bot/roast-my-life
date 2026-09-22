"use client";

import Link from "next/link";
import posthog from "posthog-js";

type Props = {
  location: "header" | "footer";
  className?: string;
  children: React.ReactNode;
};

/** "Get your own roast" link for the public share page; tracks where the click came from. */
export function ShareCta({ location, className, children }: Props) {
  return (
    <Link
      href="/signup"
      onClick={() => posthog.capture("share_page_cta_clicked", { location })}
      className={className}
    >
      {children}
    </Link>
  );
}
