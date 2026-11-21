import "server-only";

import { HardDrive, ScanFace } from "lucide-react";

import { getCachedQuotaUsage } from "~/server/cached";

import { PedirMas } from "./pedir-mas";

/**
 * Cuánto lugar le queda a la cuenta: espacio para fotos y reconocimientos del
 * mes. Va abajo del riel, en todas las pantallas del panel.
 *
 * El espacio es la cuota que frena: cuando se llena, la subida se corta con un
 * 413 (ver presign). Un fotógrafo que se entera ahí se entera en el medio de
 * un evento, con la tarjeta de la cámara en la mano. Esto es para que lo vea
 * venir, con la cuenta hecha en fotos y no en gigas, que es como piensa.
 *
 * Es un componente de servidor que se monta adentro de un Suspense desde el
 * layout: la suma de tamaños no puede demorar el riel de cada pantalla. Lee
 * del caché de 30 segundos (cached.ts).
 */

const GB = 1024 ** 3;
const MB = 1024 ** 2;

/** Desde acá la barra cambia de color y aparece el botón para pedir más. */
const ALTO = 80;
const LLENO = 95;

/** Redondea para abajo: con 239,6 GB de 240 tiene que decir 239 y no «240 de
 *  240», que se lee como lleno cuando todavía entran fotos. */
function tamano(bytes: number): string {
  const abajo = (x: number, dec: number) => Math.floor(x * 10 ** dec) / 10 ** dec;
  if (bytes >= 100 * GB) return `${abajo(bytes / GB, 0).toLocaleString("es-AR")} GB`;
  if (bytes >= GB) return `${abajo(bytes / GB, 1).toLocaleString("es-AR")} GB`;
  return `${Math.max(0, abajo(bytes / MB, 0)).toLocaleString("es-AR")} MB`;
}

function n(x: number) {
  return x.toLocaleString("es-AR");
}

/** «unas 2.300»: una estimación no lleva el último dígito. */
function aprox(x: number) {
  if (x < 100) return n(x);
  const paso = x < 1000 ? 10 : 100;
  return `unas ${n(Math.floor(x / paso) * paso)}`;
}

function nivel(pct: number): "ok" | "alto" | "lleno" {
  return pct >= LLENO ? "lleno" : pct >= ALTO ? "alto" : "ok";
}

export async function UsoCuenta({ userId }: { userId: string }) {
  const q = await getCachedQuotaUsage(userId).catch(() => null);
  if (!q) return null;

  const usado = Number(q.storage.usedBytes);
  const limite = Number(q.storage.limitBytes);
  const queda = Math.max(0, limite - usado);
  const papelera = Number(q.storage.trashBytes);
  // Con pocas fotos el promedio no dice nada (una portada de 200 KB haría
  // prometer un millón de fotos), así que la cuenta en fotos sale desde 50.
  const promedio = q.storage.photoCount >= 50 ? usado / q.storage.photoCount : null;
  const entran = promedio ? Math.floor(queda / promedio) : null;
  const nEsp = nivel(q.storage.pct);

  const r = q.recognitions;
  const quedaRec = r.limit - r.used;
  const nRec = nivel(r.pct);
  // El mes de la cuota es UTC (quotas.ts): se renueva el 1 a la medianoche UTC.
  const renueva = `1/${(r.month % 12) + 1}`;

  const restoEsp =
    queda <= 0
      ? "Sin espacio: no se pueden subir más fotos"
      : `Quedan ${tamano(queda)}${entran !== null ? ` · ${aprox(entran)} fotos` : ""}`;
  const restoRec =
    quedaRec >= 0
      ? `Quedan ${n(quedaRec)} hasta el ${renueva}`
      : `${n(-quedaRec)} por encima del cupo hasta el ${renueva}`;

  // El renglón de «quedan» se ve sólo cuando hay que mirarlo. Con lugar de
  // sobra va al globito: el riel ya está justo en una notebook de 768 px de
  // alto, y dos renglones fijos lo hacían scrollear para llegar al perfil.
  const tipEsp = [
    nEsp === "ok" ? `${restoEsp}.` : null,
    `${n(q.storage.photoCount)} fotos en tu cuenta.`,
    papelera > 0
      ? `${tamano(papelera)} son fotos borradas: se liberan 30 días después de borrarlas.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
  const tipRec = [
    nRec === "ok" ? `${restoRec}.` : null,
    `Este mes: ${n(r.fotos)} fotos analizadas, ${n(r.selfies)} búsquedas por selfie y ${n(r.dorsales)} lecturas de dorsal.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className="uso"
      aria-label="Uso de la cuenta"
      data-nivel={nEsp === "ok" && nRec === "ok" ? "ok" : "atencion"}
    >
      <div className="uso-f" data-tip={tipEsp}>
        <div className="uso-t">
          <span>
            <HardDrive /> Espacio
          </span>
          <span className="tnum">
            {tamano(usado)} de {tamano(limite)}
          </span>
        </div>
        <div
          className="uso-b"
          data-nivel={nEsp}
          role="meter"
          aria-label="Espacio usado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, q.storage.pct)}
        >
          <i style={{ width: `${Math.min(100, q.storage.pct)}%` }} />
        </div>
        {nEsp !== "ok" && (
          <div className="uso-s" data-nivel={nEsp}>
            {restoEsp}
          </div>
        )}
      </div>

      <div className="uso-f" data-tip={tipRec}>
        <div className="uso-t">
          <span>
            <ScanFace /> Reconocimiento
          </span>
          <span className="tnum">
            {n(r.used)} de {n(r.limit)}
          </span>
        </div>
        <div
          className="uso-b"
          data-nivel={nRec}
          role="meter"
          aria-label="Reconocimientos usados este mes"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, r.pct)}
        >
          <i style={{ width: `${Math.min(100, r.pct)}%` }} />
        </div>
        {nRec !== "ok" && (
          <div className="uso-s" data-nivel={nRec}>
            {restoRec}
          </div>
        )}
      </div>

      {nEsp !== "ok" ? (
        <PedirMas texto="Pedir más espacio" />
      ) : nRec !== "ok" ? (
        <PedirMas texto="Ampliar el cupo" />
      ) : null}
    </div>
  );
}
