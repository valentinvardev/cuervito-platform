import { SkelHead, SkelLine, SkelList } from "../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap-ventas">
      <SkelHead title={160} subtitle={460} />

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <SkelLine width={180} height={36} style={{ borderRadius: 8 }} />
        <SkelLine width={160} height={36} style={{ borderRadius: 8 }} />
      </div>

      <SkelList rows={8} />
    </main>
  );
}
