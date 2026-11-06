import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-text-legacy">
      <div className="text-center">
        <h1 className="text-6xl font-black text-ember-legacy mb-4">404</h1>
        <p className="text-xl text-text-secondary-legacy mb-8">Roast not found</p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-ember-legacy text-on-accent font-bold rounded-lg hover:bg-[#e63600] transition"
        >
          Go Home
        </Link>
      </div>
    </main>
  );
}
