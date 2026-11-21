export type QuotaUsage = {
  storage: {
    usedBytes: bigint;
    limitBytes: bigint;
    pct: number;
    overrideActive: boolean;
    /** Fotos que ocupan lugar, borradas incluidas. Da el tamaño promedio con
     *  el que se estima cuántas más entran. */
    photoCount: number;
    /** Lo que ocupan las fotos borradas que todavía no se purgaron. Cuentan
     *  para la cuota porque siguen en S3: el que las compró las puede bajar
     *  hasta que /api/cron/cleanup las borre de verdad. */
    trashBytes: bigint;
  };
  recognitions: {
    used: number;
    limit: number;
    pct: number;
    overrideActive: boolean;
    year: number;
    month: number;
    /** El desglose de `used`, en llamadas facturables. */
    fotos: number;
    selfies: number;
    dorsales: number;
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
