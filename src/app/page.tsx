import { HomePage } from "@/components/home-page";
import { PRO_PRICE } from "@/lib/plans";
import { pageMetadata } from "@/lib/seo";
import { SITE_URL } from "@/lib/site";

const TITLE = "Ember — AI Accountability App That Roasts Your Habits";
const DESCRIPTION =
  "Ember is an AI accountability app for self-tracking. Get honest roasts of your habits, daily check-ins, and a Life Score that shows if you're improving.";

export const metadata = pageMetadata({
  title: TITLE,
  description: DESCRIPTION,
  path: "/",
  absoluteTitle: true,
});

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Ember",
      url: SITE_URL,
      description: DESCRIPTION,
      applicationCategory: "LifestyleApplication",
      operatingSystem: "Web",
      image: `${SITE_URL}/og-image.png`,
      publisher: { "@id": `${SITE_URL}/#org` },
      offers: [
        { "@type": "Offer", name: "Free", price: "0", priceCurrency: "USD" },
        { "@type": "Offer", name: "Pro", price: PRO_PRICE.replace("$", ""), priceCurrency: "USD" },
      ],
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Ember",
      url: SITE_URL,
      logo: `${SITE_URL}/icon-512.png`,
    },
  ],
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Escape "<" so no string value can close the script tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <HomePage />
    </>
  );
}
