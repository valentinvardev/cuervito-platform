import { SkelHead, SkelLine } from "../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap-tienda">
      <SkelHead title={220} subtitle={380} />

      {/* Dominio section */}
      <div className="section">
        <div className="section-head">
          <SkelLine width={100} height={18} style={{ marginBottom: 0 }} />
        </div>
        <SkelLine width="100%" height={48} style={{ borderRadius: 10, marginBottom: 12 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <SkelLine width={180} height={40} style={{ borderRadius: 8 }} />
          <SkelLine width={180} height={40} style={{ borderRadius: 8 }} />
        </div>
      </div>

      {/* Color section */}
      <div className="section">
        <div className="section-head">
          <SkelLine width={140} height={18} style={{ marginBottom: 0 }} />
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: 10,
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="skel"
              style={{ aspectRatio: "1/1", borderRadius: 10 }}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
