import { SkelLine, SkelPhotoGrid } from "../../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap">
      {/* Cover */}
      <div
        className="skel"
        style={{
          aspectRatio: "16/6",
          width: "100%",
          borderRadius: 14,
          marginBottom: 22,
        }}
      />

      {/* Title + sub */}
      <SkelLine width={320} height={32} style={{ borderRadius: 8, marginBottom: 8 }} />
      <SkelLine width={420} height={14} style={{ marginBottom: 22 }} />

      {/* Tabs / actions row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
        <SkelLine width={140} height={36} style={{ borderRadius: 8 }} />
        <SkelLine width={120} height={36} style={{ borderRadius: 8 }} />
        <SkelLine width={100} height={36} style={{ borderRadius: 8 }} />
      </div>

      {/* Photo grid */}
      <SkelPhotoGrid count={12} />
    </main>
  );
}
