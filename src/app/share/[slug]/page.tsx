import { redirect } from "next/navigation";

export default async function ShareRoastPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/roast/${slug}`);
}
