import { fechaISO, sumarDias, type Mes } from "../periodo.js";
import { PRECIOS } from "./precios.js";

/**
 * El gasto MEDIDO por AWS, con Cost Explorer. Opcional.
 *
 * Es el número de la factura, pero de TODA la cuenta: la cuenta de AWS la
 * comparte encontrate con otro proyecto (el bucket es el mismo), y Cost
 * Explorer no puede separar un prefijo de un bucket. Por eso sale al lado de
 * la estimación y no en su lugar: la estimación es sólo de encontrate, la
 * medición es de todo, y la comparación entre las dos dice cuánto es de
 * encontrate y si hay gasto que la app no está viendo.
 *
 * Cada consulta a Cost Explorer cuesta un centavo de dólar, y el servidor
 * acepta sesenta pedidos por minuto. Sin caché, un agente preguntando en loop
 * serían 36 dólares por hora. Así que el resultado se guarda seis horas por
 * mes, que es más o menos lo que tarda Cost Explorer en actualizarse. Los
 * errores se guardan cinco minutos, para no reintentar en cada pedido algo
 * que va a volver a fallar.
 */

export type CostosMedidos =
  | {
      available: true;
      scope: "account";
      total_usd: number;
      by_service: { service: string; cost_usd: number }[];
      forecast_month_end_usd: number | null;
      age_s: number;
      note: string;
    }
  | { available: false; unavailable_reason: string };

/** Lo que hace falta de Cost Explorer. Se inyecta para poder probarlo sin AWS. */
export type FuenteCostos = {
  /** Costo por servicio en [inicio, fin), fechas YYYY-MM-DD en UTC. Una llamada por página. */
  costos(inicio: string, fin: string): Promise<{ servicio: string; usd: number }[]>;
  /** Pronóstico del costo en [inicio, fin), o null si Cost Explorer no puede pronosticar. */
  pronostico(inicio: string, fin: string): Promise<number | null>;
};

const TTL_OK_MS = 6 * 3600_000;
const TTL_ERROR_MS = 5 * 60_000;

/** Los nombres de servicio que devuelve Cost Explorer, pero sólo con caracteres esperables. */
const NOMBRE_SERVICIO = /^[\w .,&()/-]{1,80}$/;

const redondear = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** La fuente de verdad: el SDK, cargado recién cuando hace falta. */
export async function fuenteAws(): Promise<FuenteCostos> {
  const { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } = await import(
    "@aws-sdk/client-cost-explorer"
  );
  // Cost Explorer vive en us-east-1 sin importar dónde estén los recursos.
  const ce = new CostExplorerClient({ region: "us-east-1", maxAttempts: 2 });
  return {
    async costos(inicio, fin) {
      const filas: { servicio: string; usd: number }[] = [];
      let token: string | undefined;
      // Cada página se paga; con agrupar por servicio alcanza una, pero no se
      // asume: se corta a las cinco por las dudas.
      for (let pagina = 0; pagina < 5; pagina++) {
        const r = await ce.send(
          new GetCostAndUsageCommand({
            TimePeriod: { Start: inicio, End: fin },
            Granularity: "MONTHLY",
            Metrics: ["UnblendedCost"],
            GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
            NextPageToken: token,
          }),
          { abortSignal: AbortSignal.timeout(10_000) },
        );
        for (const periodo of r.ResultsByTime ?? []) {
          for (const g of periodo.Groups ?? []) {
            filas.push({ servicio: g.Keys?.[0] ?? "", usd: Number(g.Metrics?.UnblendedCost?.Amount ?? 0) });
          }
        }
        token = r.NextPageToken;
        if (!token) break;
      }
      return filas;
    },
    async pronostico(inicio, fin) {
      try {
        const r = await ce.send(
          new GetCostForecastCommand({
            TimePeriod: { Start: inicio, End: fin },
            Metric: "UNBLENDED_COST",
            Granularity: "MONTHLY",
          }),
          { abortSignal: AbortSignal.timeout(10_000) },
        );
        const n = Number(r.Total?.Amount);
        return Number.isFinite(n) ? n : null;
      } catch {
        // Sin historia suficiente, Cost Explorer no pronostica. No es un error
        // del resto: el gasto medido sale igual.
        return null;
      }
    },
  };
}

function razonDeError(e: unknown): string {
  const nombre = (e as { name?: string })?.name ?? "";
  const mensaje = e instanceof Error ? e.message : "";
  if (/not enabled for cost explorer/i.test(mensaje)) {
    return "Cost Explorer no está habilitado en la cuenta de AWS: se habilita una vez desde la consola de facturación y tarda hasta 24 horas en tener datos.";
  }
  if (/AccessDenied/i.test(nombre) || /not authorized/i.test(mensaje)) {
    return "El usuario de AWS del servidor no tiene permiso para leer costos: le faltan ce:GetCostAndUsage y ce:GetCostForecast.";
  }
  if (/Credential/i.test(nombre) || /Could not load credentials/i.test(mensaje)) {
    return "El servidor no tiene credenciales de AWS configuradas.";
  }
  if (/DataUnavailable/i.test(nombre)) {
    return "Cost Explorer todavía no tiene datos para ese período.";
  }
  if (/Timeout|Abort/i.test(nombre)) {
    return "Cost Explorer tardó demasiado en contestar.";
  }
  return "No se pudo leer Cost Explorer.";
}

export function crearLectorCostosMedidos(opts: {
  activo: boolean;
  fuente?: () => Promise<FuenteCostos>;
  ahora?: () => Date;
}): (mes: Mes) => Promise<CostosMedidos> {
  const ahora = opts.ahora ?? (() => new Date());
  const obtenerFuente = opts.fuente ?? fuenteAws;
  const cache = new Map<string, { guardado: number; ttl: number; valor: CostosMedidos }>();

  return async (mes) => {
    if (!opts.activo) {
      return {
        available: false,
        unavailable_reason:
          "Cost Explorer no está activado en este servidor: hace falta AWS_COST_EXPLORER=true y un usuario de AWS con ce:GetCostAndUsage y ce:GetCostForecast.",
      };
    }

    const clave = fechaISO(mes.primerDia);
    const t = ahora().getTime();
    const guardado = cache.get(clave);
    if (guardado && t - guardado.guardado < guardado.ttl) {
      return guardado.valor.available
        ? { ...guardado.valor, age_s: Math.round((t - guardado.guardado) / 1000) }
        : guardado.valor;
    }

    try {
      const fuente = await obtenerFuente();
      const inicio = fechaISO(mes.primerDia);
      const finMes = fechaISO(sumarDias(mes.ultimoDia, 1));
      const hoy = ahora().toISOString().slice(0, 10);

      /* En el mes en curso, sólo los días COMPLETOS: hasta hoy exclusive. El
         día de hoy en Cost Explorer está a medio cargar y cambia durante el
         día. Lo que falta del mes lo pone el pronóstico, desde hoy. El día 1
         todavía no hay días completos y no se pide nada. */
      const fin = mes.esActual ? hoy : finMes;
      const filas = inicio < fin ? await fuente.costos(inicio, fin) : [];

      const porServicio = new Map<string, number>();
      for (const f of filas) {
        const nombre = NOMBRE_SERVICIO.test(f.servicio) ? f.servicio : "otro servicio";
        if (!Number.isFinite(f.usd)) continue;
        porServicio.set(nombre, (porServicio.get(nombre) ?? 0) + f.usd);
      }
      const bySv = [...porServicio]
        .map(([service, usd]) => ({ service, cost_usd: redondear(usd) }))
        .filter((s) => Math.abs(s.cost_usd) >= 0.0001)
        .sort((a, b) => b.cost_usd - a.cost_usd);
      const total = redondear(bySv.reduce((a, s) => a + s.cost_usd, 0), 2);

      let pronostico: number | null = null;
      if (mes.esActual && hoy < finMes) {
        const resto = await fuente.pronostico(hoy, finMes);
        pronostico = resto === null ? null : redondear(total + resto, 2);
      }

      const valor: CostosMedidos = {
        available: true,
        scope: "account",
        total_usd: total,
        by_service: bySv,
        forecast_month_end_usd: pronostico,
        age_s: 0,
        note: mes.esActual
          ? "Toda la cuenta de AWS, que comparte encontrate con otro proyecto. Días completos hasta ayer; el pronóstico es de Cost Explorer."
          : "Toda la cuenta de AWS, que comparte encontrate con otro proyecto.",
      };
      cache.set(clave, { guardado: t, ttl: TTL_OK_MS, valor });
      return valor;
    } catch (e) {
      const valor: CostosMedidos = { available: false, unavailable_reason: razonDeError(e) };
      cache.set(clave, { guardado: t, ttl: TTL_ERROR_MS, valor });
      return valor;
    }
  };
}

/*
 * Uno por proceso. El servidor arma un McpServer nuevo por pedido; si cada
 * uno creara su propio lector, la caché duraría un pedido y cada consulta
 * costaría dos centavos.
 */
const compartidos = new Map<boolean, (mes: Mes) => Promise<CostosMedidos>>();
export function lectorCostosCompartido(activo: boolean) {
  let l = compartidos.get(activo);
  if (!l) {
    l = crearLectorCostosMedidos({ activo });
    compartidos.set(activo, l);
  }
  return l;
}

/** Lo que cuesta, a lo sumo, una lectura: dos pedidos a Cost Explorer. */
export const COSTO_LECTURA_USD = 2 * PRECIOS.costExplorerPedido;
