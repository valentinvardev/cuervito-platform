import "server-only";

import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { NodeHttpHandler } from "@smithy/node-http-handler";

import { env } from "~/env";
import { db } from "~/server/db";
import type { PedidoDerivados, RespuestaDerivados } from "~/server/derivados";

/**
 * Pedirle los derivados de una foto a la Lambda que vive al lado de S3.
 *
 * El VPS baja cada original de 15 MB en unos diez segundos, y en un núcleo
 * solo el trabajo de imagen pasa de a uno: con un evento grande la cola no
 * llegaba a la par de las subidas. La Lambda corre en la misma región que el
 * bucket —el original le llega en menos de un segundo y sin pagar salida—, y
 * corren muchas a la vez. El VPS sólo espera la respuesta.
 *
 * La cola no cambia: el lease, los reintentos y la escritura en la base siguen
 * siendo del VPS. La Lambda recibe todo resuelto y no toca la base.
 *
 * Nunca es obligatoria. Sin PROCESADOR_LAMBDA, o si falla por lo que sea, la
 * foto se procesa en el VPS como siempre: devolver null es "hacelo vos".
 */

let cliente: LambdaClient | null = null;
function lambda(): LambdaClient {
  cliente ??= new LambdaClient({
    region: env.AWS_REGION,
    // Sin reintentos del SDK: si falla, el VPS la procesa él, que es más
    // rápido que volver a esperar una Lambda que no anda.
    maxAttempts: 1,
    requestHandler: new NodeHttpHandler({
      connectionTimeout: 5_000,
      /* Los dos topes, y el flag sin el cual el primero no corta nada: sin
         throwOnRequestTimeout, este SDK sólo escribe un aviso y sigue
         esperando. La Lambda tiene 60 s; mientras trabaja la conexión no
         manda un byte, así que el corte por inactividad va por encima de eso.
         Una conexión colgada termina acá, como un fallo, y la foto la hace el
         VPS; sin esto la esperaba el tope de la cola, doce minutos. */
      requestTimeout: 90_000,
      socketTimeout: 75_000,
      throwOnRequestTimeout: true,
    }),
  });
  return cliente;
}

/* ── Cuántas a la vez ──────────────────────────────────────────────────────

   La cuenta de AWS tiene un límite de Lambdas simultáneas, compartido con
   otras funciones. Pasarse no es una falla de la Lambda: AWS contesta "estás
   pidiendo muchas" en el acto. Así que el VPS no pide más de
   PROCESADOR_LAMBDA_A_LA_VEZ a la vez —las demás unidades esperan su turno,
   que para ellas es sólo red— y un rechazo por límite hace esa foto en el VPS
   sin contarlo como falla. */
declare global {
  var __cuervito_lambda_derivados__:
    | {
        enCurso: number;
        esperando: Array<() => void>;
        fallos: number;
        pausaHasta: number;
        probando: boolean;
        ultimoError: string | null;
        hora: string;
        enLambda: number;
        enLocal: number;
        anotadoEn: number;
      }
    | undefined;
}
const estado = (globalThis.__cuervito_lambda_derivados__ ??= {
  enCurso: 0,
  esperando: [],
  fallos: 0,
  pausaHasta: 0,
  probando: false,
  ultimoError: null,
  hora: "",
  enLambda: 0,
  enLocal: 0,
  anotadoEn: 0,
});

function tomarTurno(signal?: AbortSignal): Promise<boolean> {
  if (estado.enCurso < env.PROCESADOR_LAMBDA_A_LA_VEZ) {
    estado.enCurso++;
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const avisar = () => {
      estado.enCurso++;
      resolve(true);
    };
    estado.esperando.push(avisar);
    signal?.addEventListener(
      "abort",
      () => {
        const i = estado.esperando.indexOf(avisar);
        if (i >= 0) estado.esperando.splice(i, 1);
        resolve(false);
      },
      { once: true },
    );
  });
}

function soltarTurno(): void {
  estado.enCurso--;
  estado.esperando.shift()?.();
}

/* ── La pausa ──────────────────────────────────────────────────────────────

   Si la Lambda falla varias veces seguidas —mal configurada, sin permiso, en
   otra región—, probarla con cada foto sólo agrega una espera antes de
   procesar en el VPS. Después de FALLOS_PARA_PAUSAR fallos seguidos se deja de
   intentar durante PAUSA_MS, y al volver pasa UNA foto de prueba: las demás
   siguen en el VPS hasta que esa conteste. */
const FALLOS_PARA_PAUSAR = 5;
const PAUSA_MS = 5 * 60_000;

/** Si conviene pedírsela a la Lambda. Reserva la prueba cuando termina una pausa. */
function puedoPedir(): "si" | "prueba" | "no" {
  if (!env.PROCESADOR_LAMBDA) return "no";
  if (estado.pausaHasta === 0) return "si";
  if (Date.now() < estado.pausaHasta || estado.probando) return "no";
  estado.probando = true;
  return "prueba";
}

export function lambdaConfigurada(): boolean {
  return Boolean(env.PROCESADOR_LAMBDA);
}

function anotarExito(): void {
  estado.fallos = 0;
  estado.pausaHasta = 0;
  estado.probando = false;
  contar("lambda");
}

function anotarFallo(nombre: string, detalle: string): void {
  estado.fallos++;
  estado.probando = false;
  estado.ultimoError = nombre;
  console.warn(`[derivados] la Lambda falló (${estado.fallos} seguidos): ${nombre}: ${detalle.slice(0, 300)}`);
  if (estado.fallos >= FALLOS_PARA_PAUSAR) {
    estado.pausaHasta = Date.now() + PAUSA_MS;
    // Al volver alcanza un fallo más para pausar de nuevo.
    estado.fallos = FALLOS_PARA_PAUSAR - 1;
    console.error(`[derivados] Lambda en pausa hasta ${new Date(estado.pausaHasta).toISOString()}: se procesa en el VPS`);
  }
  anotarEstado(true);
}

/* ── Lo que ve el MCP ──────────────────────────────────────────────────────

   Si la Lambda deja de andar, las fotos se siguen procesando —en el VPS, más
   lento— y nada se rompe a la vista. Por eso el estado queda en Setting,
   como el freno del reconocimiento: si está en pausa, el último error (sólo
   el nombre, nunca el mensaje, que puede traer claves o ARNs) y cuántas fotos
   hizo cada lado en la hora. */
export const CLAVE_ESTADO_LAMBDA = "procesador:lambda";

/** Una foto que terminó en el VPS aunque la Lambda estaba configurada. */
export function contarLocal(): void {
  if (env.PROCESADOR_LAMBDA) contar("local");
}

function contar(lado: "lambda" | "local"): void {
  const hora = new Date().toISOString().slice(0, 13);
  if (estado.hora !== hora) {
    estado.hora = hora;
    estado.enLambda = 0;
    estado.enLocal = 0;
  }
  if (lado === "lambda") estado.enLambda++;
  else estado.enLocal++;
  anotarEstado(false);
}

let pendiente: ReturnType<typeof setTimeout> | null = null;

function anotarEstado(ya: boolean): void {
  // Una escritura cada medio minuto como mucho, salvo cambios de estado. Lo
  // que queda sin escribir se escribe al cumplirse el medio minuto: si no, al
  // final de una tanda la fila quedaba con la cuenta de su primera foto.
  const pasaron = Date.now() - estado.anotadoEn;
  if (!ya && pasaron < 30_000) {
    if (!pendiente) {
      pendiente = setTimeout(() => {
        pendiente = null;
        anotarEstado(true);
      }, 30_000 - pasaron);
      pendiente.unref?.();
    }
    return;
  }
  if (pendiente) {
    clearTimeout(pendiente);
    pendiente = null;
  }
  estado.anotadoEn = Date.now();
  const value = JSON.stringify({
    actualizado: new Date().toISOString(),
    pausaHasta: estado.pausaHasta > Date.now() ? new Date(estado.pausaHasta).toISOString() : null,
    fallosSeguidos: estado.fallos,
    ultimoError: estado.ultimoError,
    hora: estado.hora,
    enLambda: estado.enLambda,
    enLocal: estado.enLocal,
  });
  void db.setting
    .upsert({ where: { key: CLAVE_ESTADO_LAMBDA }, update: { value }, create: { key: CLAVE_ESTADO_LAMBDA, value } })
    .catch(() => undefined);
}

/* ── La invocación ─────────────────────────────────────────────────────── */

/** Lo que pasó con el pedido, para el diagnóstico de tiempos. */
export type ResultadoLambda =
  | { ok: true; respuesta: Extract<RespuestaDerivados, { ok: true }> }
  | { ok: false; por: "apagada" | "pausa" | "ocupada" | "angosta" | "imagen" | "fallo" | "cortada" };

/**
 * Los derivados hechos por la Lambda, o por qué no: en ese caso la foto se
 * hace en el VPS. Nunca tira.
 */
export async function derivadosEnLambda(
  pedido: PedidoDerivados,
  signal?: AbortSignal,
): Promise<ResultadoLambda> {
  const nombre = env.PROCESADOR_LAMBDA;
  if (!nombre) return { ok: false, por: "apagada" };
  const permiso = puedoPedir();
  if (permiso === "no") return { ok: false, por: "pausa" };

  if (!(await tomarTurno(signal))) {
    if (permiso === "prueba") estado.probando = false;
    return { ok: false, por: "cortada" };
  }
  try {
    const r = await lambda().send(
      new InvokeCommand({
        FunctionName: nombre,
        InvocationType: "RequestResponse",
        Payload: Buffer.from(JSON.stringify(pedido)),
      }),
      { abortSignal: signal },
    );
    const texto = r.Payload ? Buffer.from(r.Payload).toString("utf8") : "";
    if (r.FunctionError) {
      anotarFallo(`FunctionError:${r.FunctionError}`, texto);
      return { ok: false, por: "fallo" };
    }
    const resp = JSON.parse(texto) as RespuestaDerivados;
    if (resp.ok) {
      anotarExito();
      return { ok: true, respuesta: resp };
    }
    // Ni "angosta" ni "imagen" son fallas de la Lambda: son fotos que le tocan
    // al VPS, que además es el que decide si una imagen rota es permanente.
    if (resp.motivo === "angosta" || resp.motivo === "imagen") {
      if (resp.motivo === "imagen") console.warn(`[derivados] la Lambda no pudo abrir la foto: ${resp.mensaje ?? ""}`);
      if (permiso === "prueba") estado.probando = false;
      return { ok: false, por: resp.motivo };
    }
    anotarFallo("error", resp.mensaje ?? "sin mensaje");
    return { ok: false, por: "fallo" };
  } catch (e) {
    // Cortada por el tope de la cola: no es culpa de la Lambda.
    if (signal?.aborted) {
      if (permiso === "prueba") estado.probando = false;
      return { ok: false, por: "cortada" };
    }
    const nombreError = e instanceof Error ? e.name : "Error";
    // "Muchas a la vez" en la cuenta: esta foto va al VPS, sin contarlo como falla.
    if (nombreError === "TooManyRequestsException") {
      if (permiso === "prueba") estado.probando = false;
      return { ok: false, por: "ocupada" };
    }
    anotarFallo(nombreError, e instanceof Error ? e.message : String(e));
    return { ok: false, por: "fallo" };
  } finally {
    soltarTurno();
  }
}
