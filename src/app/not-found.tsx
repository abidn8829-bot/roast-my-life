import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0A] px-4 text-[#FAFAFA]">
      <div className="text-center">
        <h1 className="text-6xl font-black text-[#FF3D00] mb-4">404</h1>
        <p className="text-xl text-neutral-400 mb-8">Roast not found</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-[#FF3D00] text-white font-bold rounded-lg hover:bg-[#e63600] transition"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
