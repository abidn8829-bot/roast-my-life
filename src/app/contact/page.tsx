import { ContactPage } from "@/components/contact-page";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contact Us",
  description: "Questions, feedback or a roast that went too far? Send the Ember team a message and we'll get back to you.",
  path: "/contact",
});

export default function Page() {
  return <ContactPage />;
}
