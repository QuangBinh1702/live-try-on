"use client";

export type Shot = { id: string; dataUrl: string; label: string; at: number };

/** Side-by-side comparison of outfit snapshots. */
export function CompareModal({ shots, onClose }: { shots: Shot[]; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-black/90 p-4" role="dialog" aria-label="So sánh outfit">
      <div className="mb-3 flex items-center justify-between text-white">
        <h2 className="text-lg font-semibold">So sánh outfit</h2>
        <button onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 hover:bg-white/20">
          Đóng
        </button>
      </div>
      <div className={`grid flex-1 gap-3 ${shots.length > 1 ? "md:grid-cols-2" : ""} ${shots.length > 2 ? "lg:grid-cols-3" : ""}`}>
        {shots.map((s) => (
          <figure key={s.id} className="flex min-h-0 flex-col">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={s.dataUrl} alt={s.label} className="min-h-0 flex-1 rounded-xl object-contain" />
            <figcaption className="mt-1 truncate text-center text-sm text-white/80">{s.label}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}
