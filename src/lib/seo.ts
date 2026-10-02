import type { Metadata } from "next";

export const SITE_NAME = "Ember";
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Ember — the AI accountability app that roasts your habits",
};

type PageSeo = {
  title: string;
  description: string;
  /** Canonical path, e.g. "/pricing". Resolved against metadataBase. */
  path: string;
  noindex?: boolean;
  /** Skip the "| Ember" title template (used by the home page). */
  absoluteTitle?: boolean;
};

// Child `openGraph`/`twitter` replace the root layout's wholesale, so every page
// builds its own full set here instead of inheriting the home page's.
export function pageMetadata({ title, description, path, noindex, absoluteTitle }: PageSeo): Metadata {
  const socialTitle = absoluteTitle ? title : `${title} | ${SITE_NAME}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    ...(noindex && { robots: { index: false, follow: true } }),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      url: path,
      title: socialTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
