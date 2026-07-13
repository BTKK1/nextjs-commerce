export default function DashboardLoading() {
  return (
    <main className="p-4 sm:p-6 lg:p-8">
      <div className="h-9 w-72 animate-pulse rounded-md bg-stone-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-md bg-stone-200" />
        ))}
      </div>
    </main>
  );
}
