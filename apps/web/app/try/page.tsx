import Studio from "@/components/Studio";

export default async function TryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const g = typeof sp.garment === "string" && /^https?:\/\//.test(sp.garment) ? sp.garment : undefined;
  return (
    <main className="min-h-screen bg-white">
      <Studio initialGarmentUrl={g} />
    </main>
  );
}
