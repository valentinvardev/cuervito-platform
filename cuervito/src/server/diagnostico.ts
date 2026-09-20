import "server-only";

import { db } from "~/server/db";

/**
 * Cuánto tardó cada paso, anotado donde se pueda leer desde afuera.
 *
 * El procesador corre en el VPS y sus `console.log` van a los logs de pm2, que
 * no se pueden mirar sin entrar al servidor. Cuando una foto tarda cuatro
 * minutos y el mismo trabajo tarda doce segundos en una laptop, la única
 * pregunta que importa es CUÁL de los pasos se lleva el tiempo, y sin esa
 * respuesta lo que sigue es adivinar.
 *
 * Así que los tiempos se guardan en `Setting`, que es la única superficie que
 * se ve desde una consulta a la base. Son las últimas veinte fotos, una fila
 * por foto con los milisegundos de cada etapa. Ocupa unos pocos KB y se
 * sobrescribe siempre.
 *
 * Es barato porque las fotos son caras: un upsert de 4 KB al lado de un
 * trabajo de varios segundos no se nota. Si algún día el trabajo baja a
 * decenas de milisegundos, esto pasa a ser caro y hay que espaciarlo.
 */

export const CLAVE_TIEMPOS = "procesador:tiempos";

const MAX_FILAS = 20;

export type FilaTiempos = {
  foto: string;
  cuando: string;
  /** Milisegundos por etapa, en el orden en que ocurrieron. */
  etapas: Record<string, number>;
  total: number;
  /** Bytes del original, para saber si el tiempo es tamaño o es otra cosa. */
  bytes?: number;
  final: "ok" | "abortada" | "error";
  detalle?: string;
};

declare global {
  var __cuervito_diag__: { filas: FilaTiempos[]; escribiendo: boolean } | undefined;
}
const estado = (globalThis.__cuervito_diag__ ??= { filas: [], escribiendo: false });

/**
 * Un cronómetro por foto. `marca()` cierra la etapa anterior y abre la
 * siguiente, así no hay que llevar variables sueltas por todo el cuerpo.
 */
export function cronometro() {
  const etapas: Record<string, number> = {};
  const arranque = Date.now();
  let ultimo = arranque;
  return {
    marca(nombre: string) {
      const ahora = Date.now();
      etapas[nombre] = (etapas[nombre] ?? 0) + (ahora - ultimo);
      ultimo = ahora;
    },
    cerrar(foto: string, final: FilaTiempos["final"], extra?: { bytes?: number; detalle?: string }) {
      anotar({
        foto,
        cuando: new Date().toISOString(),
        etapas,
        total: Date.now() - arranque,
        final,
        ...extra,
      });
    },
  };
}

function anotar(fila: FilaTiempos): void {
  estado.filas.push(fila);
  if (estado.filas.length > MAX_FILAS) estado.filas.splice(0, estado.filas.length - MAX_FILAS);
  void volcar();
}

/* Una escritura a la vez: si entran cuatro fotos juntas, la primera escribe y
   las otras se apoyan en la siguiente. Nunca puede tirar: un diagnóstico que
   rompe lo que está diagnosticando no sirve para nada. */
async function volcar(): Promise<void> {
  if (estado.escribiendo) return;
  estado.escribiendo = true;
  try {
    const value = JSON.stringify(estado.filas);
    await db.setting.upsert({
      where: { key: CLAVE_TIEMPOS },
      update: { value },
      create: { key: CLAVE_TIEMPOS, value },
    });
  } catch {
    /* que no se pueda anotar no puede frenar el procesamiento */
  } finally {
    estado.escribiendo = false;
  }
}

/** Las últimas filas, para el estado de la cola. */
export function ultimosTiempos(): FilaTiempos[] {
  return estado.filas;
}
