import type { Consulta } from "../db.js";
import type { CostosMedidos } from "../costos/cost-explorer.js";
import {
  BYTES_POR_GB,
  DERIVADOS_SOBRE_ORIGINAL,
  PRECIOS,
  PRECIOS_VERIFICADOS,
  REGION_PRECIOS,
} from "../costos/precios.js";
import { aTimestamp, fechaISO, type Mes } from "../periodo.js";

/**
 * El gasto de AWS de encontrate en un mes, ESTIMADO a partir de lo que ya
 * registra la base.
 *
 * Cada componente es una cantidad por un precio de lista. Las cantidades
 * tienen dos calidades, y cada componente dice cuál es la suya en `basis`:
 *
 * · counted: la cantidad está contada una por una. Los llamados a Rekognition
 *   los cuenta la app ANTES de hacerlos, en RecognitionUsage, con la Lambda
 *   incluida. Es el componente más caro y el más exacto.
 *
 * · estimated: la cantidad sale de tamaños y supuestos. El almacenamiento
 *   usa el peso real de los originales y un 8,2 % medido para las versiones;
 *   la transferencia supone que cada vista previa bajó el original una vez.
 *
 * Lo que no se puede saber desde la base —CloudFront, el cómputo de la
 * Lambda, el otro proyecto de la cuenta— va en `not_included`, con la razón,
 * y no como un cero.
 */

// ── Consultas ───────────────────────────────────────────────────────────────

export const SQL_COSTOS_REKOGNITION = `
select
  coalesce(sum("ocrCalls"), 0)::int as texto,
  coalesce(sum("indexRequests"), 0)::int as indexado,
  coalesce(sum("searchedFaces"), 0)::int as busquedas
from "RecognitionUsage"
where year = $1 and month = $2
`;

/**
 * Almacenamiento como byte-segundos: por cada foto, su peso por el tiempo que
 * estuvo guardada dentro del mes. Una foto borrada sigue en S3 hasta que el
 * cron la purga, `retención` días después del borrado, así que cuenta hasta
 * ahí. Las versiones existen desde que hay vista previa; se suman al peso del
 * original con el porcentaje medido.
 *
 * $1 inicio del mes · $2 fin de lo medido · $3 días de retención · $4 fracción de derivados
 */
export const SQL_COSTOS_ALMACENAMIENTO = `
select
  coalesce(sum(
    "fileSize"::float8
      * (1 + case when "previewKey" is not null then $4::float8 else 0 end)
      * greatest(0, extract(epoch from (
          least($2::timestamp, coalesce("deletedAt" + make_interval(days => $3::int), $2::timestamp))
          - greatest($1::timestamp, "createdAt")
        )))
  ), 0)::float8 as byte_segundos,
  coalesce(sum(
    "fileSize"::float8 * (1 + case when "previewKey" is not null then $4::float8 else 0 end)
  ) filter (
    where "deletedAt" is null or "deletedAt" + make_interval(days => $3::int) > $2::timestamp
  ), 0)::float8 as bytes_al_final
from "Photo"
where "fileSize" is not null
  and "createdAt" < $2::timestamp
  and ("deletedAt" is null or "deletedAt" + make_interval(days => $3::int) > $1::timestamp)
`;

/** Caras guardadas, como cara-segundos. Las caras borradas desaparecen de la tabla: se subestima. */
export const SQL_COSTOS_CARAS = `
select
  coalesce(sum(greatest(0, extract(epoch from ($2::timestamp - greatest($1::timestamp, "createdAt"))))), 0)::float8 as cara_segundos,
  count(*)::int as caras_al_final
from "FaceRecord"
where "createdAt" < $2::timestamp
`;

/**
 * Subidas y vistas previas generadas en el mes, con sus bytes. Las columnas
 * `_acel` son la parte desde que se prendió Transfer Acceleration ($3).
 */
export const SQL_COSTOS_TRAFICO = `
select
  count(*) filter (where "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp)::int as subidas,
  coalesce(sum("fileSize") filter (where "createdAt" >= $1::timestamp and "createdAt" < $2::timestamp), 0)::float8 as bytes_subidos,
  coalesce(sum("fileSize") filter (where "createdAt" >= $3::timestamp and "createdAt" < $2::timestamp), 0)::float8 as bytes_subidos_acel,
  count(*) filter (where "previewGeneratedAt" >= $1::timestamp and "previewGeneratedAt" < $2::timestamp)::int as procesadas,
  coalesce(sum("fileSize") filter (where "previewGeneratedAt" >= $1::timestamp and "previewGeneratedAt" < $2::timestamp), 0)::float8 as bytes_procesados,
  coalesce(sum("fileSize") filter (where "previewGeneratedAt" >= $3::timestamp and "previewGeneratedAt" < $2::timestamp), 0)::float8 as bytes_procesados_acel
from "Photo"
where "fileSize" is not null
  and (("createdAt" >= $1::timestamp and "createdAt" < $2::timestamp)
    or ("previewGeneratedAt" >= $1::timestamp and "previewGeneratedAt" < $2::timestamp))
`;

/**
 * Descargas de compradores. Una descarga de UNA foto deja una fila con la
 * foto; un ZIP deja una sola fila sin foto y baja todas las de la venta.
 */
export const SQL_COSTOS_DESCARGAS = `
select
  (select count(*) from "DownloadLog" d
     where d."photoId" is not null and d."createdAt" >= $1::timestamp and d."createdAt" < $2::timestamp)::int as sueltas,
  (select coalesce(sum(p."fileSize"), 0) from "DownloadLog" d
     join "Photo" p on p.id = d."photoId"
     where d."createdAt" >= $1::timestamp and d."createdAt" < $2::timestamp)::float8 as bytes_sueltas,
  (select count(*) from "DownloadLog" d
     join "SaleItem" si on si."saleId" = d."saleId"
     join "Photo" p on p.id = si."photoId"
     where d."photoId" is null and d."createdAt" >= $1::timestamp and d."createdAt" < $2::timestamp)::int as fotos_en_zip,
  (select coalesce(sum(p."fileSize"), 0) from "DownloadLog" d
     join "SaleItem" si on si."saleId" = d."saleId"
     join "Photo" p on p.id = si."photoId"
     where d."photoId" is null and d."createdAt" >= $1::timestamp and d."createdAt" < $2::timestamp)::float8 as bytes_zip,
  (select coalesce(sum(p."fileSize"), 0) from "DownloadLog" d
     join "Photo" p on p.id = d."photoId"
     where d."createdAt" >= $3::timestamp and d."createdAt" < $2::timestamp)::float8
  + (select coalesce(sum(p."fileSize"), 0) from "DownloadLog" d
     join "SaleItem" si on si."saleId" = d."saleId"
     join "Photo" p on p.id = si."photoId"
     where d."photoId" is null and d."createdAt" >= $3::timestamp and d."createdAt" < $2::timestamp)::float8 as bytes_descargas_acel
`;

// ── Resultado ───────────────────────────────────────────────────────────────

export type Componente = {
  service: "rekognition" | "s3";
  item: string;
  quantity: number;
  unit: string;
  unit_price_usd: number;
  cost_usd: number;
  basis: "counted" | "estimated";
};

export type Costos = {
  month: {
    label: "month";
    from: string;
    to: string;
    timezone: "UTC";
    days_elapsed: number;
    days_in_month: number;
    is_current_month: boolean;
  };
  estimated: {
    scope: "encontrate";
    total_usd: number;
    projected_month_usd: number | null;
    components: Componente[];
    not_included: { item: string; reason: string }[];
    assumptions: string[];
    prices_verified_on: string;
    price_region: string;
  };
  measured: CostosMedidos;
  comparison?: {
    rekognition_estimated_usd: number;
    rekognition_measured_usd: number | null;
    rekognition_ratio: number | null;
    estimated_share_of_account: number | null;
  };
};

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
const r2 = (x: number) => Math.round(x * 100) / 100;
const r3 = (x: number) => Math.round(x * 1_000) / 1_000;

type Filas = {
  rek: { texto: number; indexado: number; busquedas: number };
  alm: { byte_segundos: number; bytes_al_final: number };
  caras: { cara_segundos: number; caras_al_final: number };
  trafico: {
    subidas: number;
    bytes_subidos: number;
    bytes_subidos_acel: number;
    procesadas: number;
    bytes_procesados: number;
    bytes_procesados_acel: number;
  };
  descargas: { sueltas: number; bytes_sueltas: number; fotos_en_zip: number; bytes_zip: number; bytes_descargas_acel: number };
};

async function leerFilas(q: Consulta, mes: Mes, retencionDias: number, aceleracionDesde: Date | null): Promise<Filas> {
  const desde = aTimestamp(mes.desde);
  const hasta = aTimestamp(mes.hastaMedido);
  // Sin aceleración, el rango acelerado queda vacío: empieza donde termina.
  const desdeAcel = aTimestamp(
    aceleracionDesde === null ? mes.hastaMedido : new Date(Math.max(aceleracionDesde.getTime(), mes.desde.getTime())),
  );
  const [rek] = await q<Filas["rek"]>(SQL_COSTOS_REKOGNITION, [mes.primerDia.y, mes.primerDia.m]);
  const [alm] = await q<Filas["alm"]>(SQL_COSTOS_ALMACENAMIENTO, [desde, hasta, retencionDias, DERIVADOS_SOBRE_ORIGINAL]);
  const [caras] = await q<Filas["caras"]>(SQL_COSTOS_CARAS, [desde, hasta]);
  const [trafico] = await q<Filas["trafico"]>(SQL_COSTOS_TRAFICO, [desde, hasta, desdeAcel]);
  const [descargas] = await q<Filas["descargas"]>(SQL_COSTOS_DESCARGAS, [desde, hasta, desdeAcel]);
  return {
    rek: rek ?? { texto: 0, indexado: 0, busquedas: 0 },
    alm: alm ?? { byte_segundos: 0, bytes_al_final: 0 },
    caras: caras ?? { cara_segundos: 0, caras_al_final: 0 },
    trafico: trafico ?? {
      subidas: 0, bytes_subidos: 0, bytes_subidos_acel: 0, procesadas: 0, bytes_procesados: 0, bytes_procesados_acel: 0,
    },
    descargas: descargas ?? { sueltas: 0, bytes_sueltas: 0, fotos_en_zip: 0, bytes_zip: 0, bytes_descargas_acel: 0 },
  };
}

/** Un componente, con el costo calculado y redondeado. */
function comp(
  service: Componente["service"],
  item: string,
  quantity: number,
  unit: string,
  precio: number,
  basis: Componente["basis"],
  redondeoCantidad: (x: number) => number = r3,
): Componente {
  return {
    service,
    item,
    quantity: redondeoCantidad(quantity),
    unit,
    unit_price_usd: precio,
    cost_usd: r4(quantity * precio),
    basis,
  };
}

export async function costos(
  q: Consulta,
  mes: Mes,
  opts: { retencionDias: number; aceleracionDesde: Date | null; medidos: CostosMedidos },
): Promise<Costos> {
  const f = await leerFilas(q, mes, opts.retencionDias, opts.aceleracionDesde);
  // La aceleración cuenta en este mes si se prendió antes de que termine lo medido.
  const aceleracion = opts.aceleracionDesde !== null && opts.aceleracionDesde < mes.hastaMedido;
  const P = PRECIOS;

  const segMes = (mes.hasta.getTime() - mes.desde.getTime()) / 1000;
  const segMedidos = Math.max(0, (mes.hastaMedido.getTime() - mes.desde.getTime()) / 1000);

  // ── Cantidades del mes (o de lo que va del mes) ──
  const gbMes = f.alm.byte_segundos / BYTES_POR_GB / segMes;
  const carasMes = f.caras.cara_segundos / segMes;
  const miles = (n: number) => n / 1000;
  const putMiles = miles(f.trafico.subidas + f.trafico.procesadas * 3);
  const getMiles = miles(f.trafico.procesadas + f.descargas.sueltas + f.descargas.fotos_en_zip);
  const gbProcesados = f.trafico.bytes_procesados / BYTES_POR_GB;
  const gbDescargas = (f.descargas.bytes_sueltas + f.descargas.bytes_zip) / BYTES_POR_GB;
  const gbSubidosAcel = f.trafico.bytes_subidos_acel / BYTES_POR_GB;
  const gbSalidaAcel = (f.trafico.bytes_procesados_acel + f.descargas.bytes_descargas_acel) / BYTES_POR_GB;

  const entero = (x: number) => Math.round(x);
  const componentes: Componente[] = [
    comp("rekognition", "detect_text", f.rek.texto, "images", P.rekognitionTexto, "counted", entero),
    comp("rekognition", "index_faces", f.rek.indexado, "images", P.rekognitionIndexado, "counted", entero),
    comp("rekognition", "search_faces", f.rek.busquedas, "images", P.rekognitionBusqueda, "counted", entero),
    comp("rekognition", "face_storage", carasMes, "face-months", P.rekognitionCaras, "estimated", (x) => Math.round(x * 10) / 10),
    comp("s3", "storage", gbMes, "GB-months", P.s3Almacenamiento, "estimated"),
    comp("s3", "put_requests", putMiles, "1k requests", P.s3Put, "estimated"),
    comp("s3", "get_requests", getMiles, "1k requests", P.s3Get, "estimated"),
    comp("s3", "transfer_out_processing", gbProcesados, "GB", P.salidaInternet, "estimated"),
    comp("s3", "transfer_out_downloads", gbDescargas, "GB", P.salidaInternet, "estimated"),
  ];
  if (aceleracion) {
    componentes.push(
      comp("s3", "acceleration_in", gbSubidosAcel, "GB", P.aceleracionEntrada, "estimated"),
      comp("s3", "acceleration_out", gbSalidaAcel, "GB", P.aceleracionSalida, "estimated"),
    );
  }

  const total = r2(componentes.reduce((a, c) => a + c.quantity * c.unit_price_usd, 0));

  // ── Proyección al mes entero ──
  // Se proyectan CANTIDADES, no costos, porque cada componente crece distinto:
  //
  // · lo que se acumula (llamados, pedidos, transferencia) sigue al ritmo de
  //   lo que va del mes;
  // · lo que se guarda (almacenamiento, caras) no crece con el tiempo: lo que
  //   está guardado ahora sigue guardado el resto del mes;
  // · la aceleración, si está prendida AHORA, se aplica a TODO el tráfico que
  //   falta, aunque se haya prendido a mitad de mes. Extrapolarla con su propio
  //   ritmo la subestimaría: tres días acelerados de veintitrés no dicen nada
  //   de los siete que quedan, que van a ir todos acelerados.
  let proyectado: number | null = null;
  if (mes.esActual && segMedidos > 0) {
    const factor = segMes / segMedidos;
    const resto = (segMes - segMedidos) / segMes;
    const falta = factor - 1;
    const proyectarCantidad = (c: Componente): number => {
      switch (c.item) {
        case "storage":
          return gbMes + (f.alm.bytes_al_final / BYTES_POR_GB) * resto;
        case "face_storage":
          return carasMes + f.caras.caras_al_final * resto;
        case "acceleration_in":
          return gbSubidosAcel + (f.trafico.bytes_subidos / BYTES_POR_GB) * falta;
        case "acceleration_out":
          return gbSalidaAcel + (gbProcesados + gbDescargas) * falta;
        default:
          return c.quantity * factor;
      }
    };
    proyectado = r2(componentes.reduce((a, c) => a + proyectarCantidad(c) * c.unit_price_usd, 0));
  }

  const supuestos = [
    `Precios de lista de ${REGION_PRECIOS}, del primer escalón y sin capa gratuita: la cuenta de AWS se comparte con otro proyecto y las franquicias son por cuenta.`,
    "Los llamados a Rekognition salen del contador de la app, que cuenta cada llamado facturable antes de hacerlo, también los de la Lambda.",
    `Las versiones de cada foto (vista previa, limpia y miniatura) pesan el ${(DERIVADOS_SOBRE_ORIGINAL * 100).toFixed(1).replace(".", ",")} % del original, medido sobre fotos reales.`,
    "Cada vista previa bajó el original una vez desde S3. Los reintentos y las regeneraciones anteriores no quedan registrados, así que la transferencia de procesamiento puede ser mayor.",
    "Un ZIP de un comprador baja todas las fotos de la venta una vez.",
  ];
  if (aceleracion) {
    const desdeCuando =
      opts.aceleracionDesde && opts.aceleracionDesde > mes.desde ? ` desde el ${fechaISO({
        y: opts.aceleracionDesde.getUTCFullYear(),
        m: opts.aceleracionDesde.getUTCMonth() + 1,
        d: opts.aceleracionDesde.getUTCDate(),
      })}` : "";
    supuestos.push(
      `Transfer Acceleration se cuenta${desdeCuando}: las subidas entran por bordes de Sudamérica y toda salida paga el recargo. AWS no lo cobra cuando no acelera, así que ese renglón es un tope.`,
    );
  }
  if (mes.esActual) supuestos.push("La proyección supone que lo que queda del mes sigue al ritmo de lo que va.");
  else supuestos.push("En meses pasados, las fotos ya purgadas de la base no cuentan en el almacenamiento.");

  const noIncluido = [
    {
      item: "cloudfront",
      reason:
        "Los bytes que sirve CloudFront no quedan en la base. Con el tráfico actual probablemente entran en la franquicia gratuita de 1 TB y 10 millones de pedidos por mes, que es por cuenta.",
    },
    {
      item: "lambda_compute",
      reason: "El cómputo de la Lambda, si está activa, no se registra. Sus llamados a Rekognition sí están contados.",
    },
    {
      item: "other_s3_objects",
      reason: "Portadas, logos, marcas de agua y archivos del editor: son pocos y chicos.",
    },
    {
      item: "other_project",
      reason: "Lo que gasta el otro proyecto que comparte la cuenta de AWS.",
    },
  ];
  if (!aceleracion) {
    noIncluido.push({
      item: "transfer_acceleration",
      reason:
        "No se suma: S3_TRANSFER_ACCELERATION no está puesta, o se prendió después de este mes. Si la app la usa, ponela con la fecha en que se prendió.",
    });
  }

  const resultado: Costos = {
    month: {
      label: "month",
      from: fechaISO(mes.primerDia),
      to: fechaISO(mes.ultimoDia),
      timezone: "UTC",
      days_elapsed: Math.round((segMedidos / 86_400) * 10) / 10,
      days_in_month: Math.round(segMes / 86_400),
      is_current_month: mes.esActual,
    },
    estimated: {
      scope: "encontrate",
      total_usd: total,
      projected_month_usd: proyectado,
      components: componentes,
      not_included: noIncluido,
      assumptions: supuestos,
      prices_verified_on: PRECIOS_VERIFICADOS,
      price_region: REGION_PRECIOS,
    },
    measured: opts.medidos,
  };

  // ── Comparación, si hay medición ──
  if (opts.medidos.available) {
    const rekEstimado = r4(
      componentes.filter((c) => c.service === "rekognition").reduce((a, c) => a + c.quantity * c.unit_price_usd, 0),
    );
    const rekMedido = opts.medidos.by_service.find((s) => s.service === "Amazon Rekognition")?.cost_usd ?? null;
    resultado.comparison = {
      rekognition_estimated_usd: rekEstimado,
      rekognition_measured_usd: rekMedido,
      rekognition_ratio: rekMedido !== null && rekEstimado > 0 ? r3(rekMedido / rekEstimado) : null,
      estimated_share_of_account: opts.medidos.total_usd > 0 ? r3(total / opts.medidos.total_usd) : null,
    };
  }

  return resultado;
}
