import { SkelHead, SkelLine } from "../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap-narrower">
      <SkelHead title={220} subtitle={300} />

      {/* MP card */}
      <div className="mp-card">
        <div className="mp-row">
          <span
            className="skel"
            style={{ width: 64, height: 64, borderRadius: 12 }}
          />
          <div style={{ flex: 1 }}>
            <SkelLine width="40%" height={18} style={{ marginBottom: 8 }} />
            <SkelLine width="60%" height={13} style={{ marginBottom: 0 }} />
          </div>
        </div>
        <SkelLine width="100%" height={80} style={{ borderRadius: 10, marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 10 }}>
          <SkelLine width={140} height={40} style={{ borderRadius: 8 }} />
          <SkelLine width={140} height={40} style={{ borderRadius: 8 }} />
        </div>
      </div>

      {/* Info notes */}
      <div className="skel-card">
        <SkelLine width="100%" height={14} />
        <SkelLine width="90%" height={14} />
        <SkelLine width="60%" height={14} style={{ marginBottom: 0 }} />
      </div>
      <div className="skel-card">
        <SkelLine width="100%" height={14} />
        <SkelLine width="80%" height={14} style={{ marginBottom: 0 }} />
      </div>
    </main>
  );
}
