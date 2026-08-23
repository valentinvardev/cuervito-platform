export function SkelLine({
  width = "100%",
  height = 14,
  style,
}: {
  width?: string | number;
  height?: number;
  style?: React.CSSProperties;
}) {
  return <span className="skel skel-line" style={{ width, height, ...style }} />;
}

export function SkelHead({
  title = 240,
  subtitle = 340,
}: {
  title?: number;
  subtitle?: number;
}) {
  return (
    <div className="head">
      <span className="skel skel-title" style={{ width: title }} />
      <span className="skel skel-sub" style={{ width: subtitle }} />
    </div>
  );
}

export function SkelCard({
  lines = 3,
  height = 14,
}: {
  lines?: number;
  height?: number;
}) {
  return (
    <div className="skel-card">
      {Array.from({ length: lines }).map((_, i) => (
        <SkelLine
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height={height}
        />
      ))}
    </div>
  );
}

export function SkelList({
  rows = 5,
}: {
  rows?: number;
}) {
  return (
    <div className="sales-card">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skel-row">
          <span className="skel skel-thumb" />
          <div>
            <SkelLine width="70%" height={14} style={{ marginBottom: 6 }} />
            <SkelLine width="40%" height={11} style={{ marginBottom: 0 }} />
          </div>
          <span className="skel" style={{ width: 64, height: 16, borderRadius: 6 }} />
        </div>
      ))}
    </div>
  );
}

export function SkelPhotoGrid({ count = 9 }: { count?: number }) {
  return (
    <div className="skel-photo-grid">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="skel skel-photo" />
      ))}
    </div>
  );
}
