// Route-level skeleton for the dashboard segment (#109): the server-first
// Home computes its one-truth read during the render, and this is what the
// household sees while it does — the hero's shape, the strip, the
// heartbeat card. Deliberately neutral enough for the other dashboard
// routes this boundary also covers (their client pages resolve instantly).

export default function DashboardLoading() {
  return (
    <div
      data-home-skeleton
      className="mx-auto max-w-md flex flex-col min-h-[70vh] animate-pulse"
      aria-hidden
    >
      {/* Settings slot */}
      <div className="flex justify-end">
        <div className="h-5 w-5 rounded-full bg-bg-secondary" />
      </div>

      {/* Hero: dot + word + sentence */}
      <div className="flex-1 flex flex-col items-center justify-center py-10">
        <div className="mb-4 h-3 w-3 rounded-full bg-bg-secondary" />
        <div className="mb-3 h-14 w-48 rounded-lg bg-bg-secondary" />
        <div className="h-4 w-72 max-w-full rounded bg-bg-secondary" />
      </div>

      {/* Strip rows */}
      <div className="mb-6 space-y-1.5">
        <div className="h-9 rounded-lg bg-bg-secondary" />
        <div className="h-9 rounded-lg bg-bg-secondary" />
      </div>

      {/* Heartbeat card */}
      <div className="mb-8 rounded-lg border border-bg-secondary bg-white p-5">
        <div className="mb-2 h-3 w-24 rounded bg-bg-secondary" />
        <div className="h-9 w-40 rounded bg-bg-secondary" />
      </div>

      {/* Doors row */}
      <div className="flex items-center justify-center gap-3 mt-2 mb-6">
        <div className="h-3 w-28 rounded bg-bg-secondary" />
        <div className="h-3 w-20 rounded bg-bg-secondary" />
      </div>
    </div>
  );
}
