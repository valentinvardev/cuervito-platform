import {
  SkelHead,
  SkelLine,
  SkelPhotoGrid,
} from "../_components/skeletons";

export default function Loading() {
  return (
    <main className="wrap-narrow">
      <SkelHead title={200} subtitle={360} />
      <div style={{ marginBottom: 18 }}>
        <SkelLine width="100%" height={40} style={{ borderRadius: 10 }} />
      </div>
      <SkelPhotoGrid count={6} />
    </main>
  );
}
