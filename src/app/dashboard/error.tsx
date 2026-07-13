"use client";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <main className="p-8">
      <div className="rounded-md border border-red-200 bg-white p-6">
        <h1 className="text-xl font-semibold text-ink">Dashboard could not load</h1>
        <p className="mt-2 text-stone-700">The local demo database may need to be seeded again.</p>
        <button
          type="button"
          onClick={reset}
          className="focus-ring mt-5 rounded-md bg-qahwa px-4 py-2 font-semibold text-white"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
