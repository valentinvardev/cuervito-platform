import { SkelHead, SkelLine } from "../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap-ayuda">
      <SkelHead title={120} subtitle={420} />

      <div className="help-list" style={{ marginBottom: 36 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 14,
              padding: "16px 18px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 12,
              alignItems: "center",
            }}
          >
            <span
              className="skel"
              style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }}
            />
            <div style={{ flex: 1 }}>
              <SkelLine width="35%" height={15} style={{ marginBottom: 6 }} />
              <SkelLine width="65%" height={12} style={{ marginBottom: 0 }} />
            </div>
          </div>
        ))}
      </div>

      <SkelLine width={220} height={20} style={{ marginBottom: 14 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <SkelLine
            key={i}
            width="100%"
            height={48}
            style={{ borderRadius: 10, marginBottom: 0 }}
          />
        ))}
      </div>
    </main>
  );
}
