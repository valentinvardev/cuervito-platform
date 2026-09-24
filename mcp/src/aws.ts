import type { Config } from "./config.js";

/**
 * Las alarmas de CloudWatch que están sonando. Opcional.
 *
 * Sólo lee: `DescribeAlarms` con estado ALARM. Del resultado se usan el
 * nombre de la alarma y cuándo cambió de estado; el motivo (`StateReason`) no,
 * porque trae los valores de la métrica y a veces dimensiones con nombres de
 * recursos.
 *
 * El procesamiento de fotos no corre en Lambda sino en la cola del servidor
 * de la aplicación, así que la salud de verdad sale de la base. Esto sirve
 * para lo que sí vive en AWS —la distribución de CloudFront, el bucket— si
 * alguien le armó alarmas.
 *
 * El SDK se importa recién cuando hace falta: sin configuración, ni se carga.
 */

export type Alarmas =
  | { available: true; alarms_in_alarm: number; alarms: { alarm: string; updated_at: string | null }[] }
  | { available: false; unavailable_reason: string };

const NOMBRE_ALARMA = /^[\w.\-/ ]{1,120}$/;

export async function leerAlarmas(cfg: Config["aws"]): Promise<Alarmas> {
  if (!cfg) {
    return {
      available: false,
      unavailable_reason: "CloudWatch no está configurado: faltan AWS_REGION y CLOUDWATCH_ALARM_PREFIX.",
    };
  }
  try {
    const { CloudWatchClient, DescribeAlarmsCommand } = await import("@aws-sdk/client-cloudwatch");
    const cw = new CloudWatchClient({ region: cfg.region, maxAttempts: 2 });
    const r = await cw.send(
      new DescribeAlarmsCommand({ StateValue: "ALARM", AlarmNamePrefix: cfg.prefijoAlarmas, MaxRecords: 50 }),
      { abortSignal: AbortSignal.timeout(5_000) },
    );
    const lista = [...(r.MetricAlarms ?? []), ...(r.CompositeAlarms ?? [])];
    return {
      available: true,
      alarms_in_alarm: lista.length,
      alarms: lista.slice(0, 20).map((a) => ({
        // Un nombre raro se reemplaza en vez de mandarse: los nombres de
        // alarma los escribe una persona y pueden traer cualquier cosa.
        alarm: a.AlarmName && NOMBRE_ALARMA.test(a.AlarmName) ? a.AlarmName : "alarma-sin-nombre-valido",
        updated_at: a.StateUpdatedTimestamp ? a.StateUpdatedTimestamp.toISOString() : null,
      })),
    };
  } catch {
    return { available: false, unavailable_reason: "No se pudieron leer las alarmas de CloudWatch." };
  }
}
