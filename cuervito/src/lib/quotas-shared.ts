export type QuotaUsage = {
  storage: {
    usedBytes: bigint;
    limitBytes: bigint;
    pct: number;
    overrideActive: boolean;
  };
  recognitions: {
    used: number;
    limit: number;
    pct: number;
    overrideActive: boolean;
    year: number;
    month: number;
  };
};

export function formatBytes(bytes: bigint | number): string {
  const n = typeof bytes === "bigint" ? Number(bytes) : bytes;
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  if (n >= GB) return `${(n / GB).toFixed(1)} GB`;
  if (n >= MB) return `${(n / MB).toFixed(1)} MB`;
  if (n >= KB) return `${(n / KB).toFixed(0)} KB`;
  return `${n} B`;
}
