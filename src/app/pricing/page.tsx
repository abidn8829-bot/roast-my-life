import { PricingPage } from "@/components/pricing-page";
import { PRO_DAILY_LIMIT } from "@/lib/daily-limit";
import { PRO_PRICE } from "@/lib/plans";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pricing — Free & Pro Plans",
  description: `Start free with one AI roast a day, or go Pro at ${PRO_PRICE}/month for ${PRO_DAILY_LIMIT} roasts a day, every persona and tone, and Your Arc progress tracking.`,
  path: "/pricing",
});

export default function Page() {
  return <PricingPage />;
}
