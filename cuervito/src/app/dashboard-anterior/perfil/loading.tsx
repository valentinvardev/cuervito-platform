import { SkelHead, SkelLine } from "../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap-narrower">
      <SkelHead title={140} subtitle={260} />

      <div className="form-card">
        <div className="profile-pic-row">
          <span
            className="skel"
            style={{ width: 64, height: 64, borderRadius: "50%" }}
          />
          <div style={{ flex: 1 }}>
            <SkelLine width="40%" height={15} style={{ marginBottom: 6 }} />
            <SkelLine width="60%" height={12} style={{ marginBottom: 0 }} />
          </div>
          <SkelLine width={110} height={36} style={{ borderRadius: 8 }} />
        </div>

        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <SkelLine width={120} height={11} style={{ marginBottom: 8 }} />
            <SkelLine width="100%" height={40} style={{ borderRadius: 8 }} />
          </div>
        ))}

        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            marginTop: 22,
            paddingTop: 18,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <SkelLine width={120} height={40} style={{ borderRadius: 8 }} />
          <SkelLine width={160} height={40} style={{ borderRadius: 8 }} />
        </div>
      </div>
    </main>
  );
}
