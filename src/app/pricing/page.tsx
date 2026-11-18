import { JournalTheme } from "@/components/journal-theme";
import { PricingPage } from "@/components/pricing-page";
import { PRO_DAILY_LIMIT } from "@/lib/daily-limit";
import { PRO_PRICE, VOICE_COUNT } from "@/lib/plans";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Pricing — Free & Pro Plans",
  description: `Start free with one AI roast a day, or go Pro at ${PRO_PRICE}/month for ${PRO_DAILY_LIMIT} roasts a day, all ${VOICE_COUNT} voices, and Your Arc progress tracking.`,
  path: "/pricing",
});

export default function Page() {
  return (
    <JournalTheme>
      <PricingPage />
    </JournalTheme>
  );
}
