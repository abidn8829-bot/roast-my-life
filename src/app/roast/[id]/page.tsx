export default async function RoastDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="p-8">
      <h1 className="text-3xl font-semibold">Roast {id}</h1>
    </main>
  );
}

