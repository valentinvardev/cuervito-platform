import { SkelCard, SkelHead, SkelLine } from "./_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap">
      <SkelHead title={280} subtitle={420} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginBottom: 24,
        }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skel-card">
            <SkelLine width="60%" height={11} style={{ marginBottom: 12 }} />
            <SkelLine width="40%" height={28} style={{ marginBottom: 6 }} />
            <SkelLine width="70%" height={11} style={{ marginBottom: 0 }} />
          </div>
        ))}
      </div>

      <SkelLine width={180} height={18} style={{ marginBottom: 14 }} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 12,
        }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <SkelCard key={i} lines={2} />
        ))}
      </div>
    </main>
  );
}
