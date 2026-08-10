"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import {
  SOURCE_COOKIE,
  VISITOR_COOKIE,
  parseTrafficSource,
  readCookie,
  writeCookie,
} from "~/lib/visitor";

/**
 * Se monta en el storefront. Hace dos cosas, ambas una sola vez por
 * visitante:
 *
 *  1. Le asigna un id anónimo, para poder cruzar sus búsquedas por selfie
 *     con la compra que haga después.
 *  2. Registra de dónde llegó la primera vez. Los links internos de
 *     Cuervito (buscador del landing, carrusel) traen `?src=`; si no hay
 *     parámetro, asumimos que entró por un link que compartió el
 *     fotógrafo.
 *
 * El origen no se pisa en visitas posteriores: es atribución de primer
 * contacto y expira a los 7 días con la cookie.
 */
export function VisitorTracker() {
  const params = useSearchParams();

  useEffect(() => {
    if (!readCookie(VISITOR_COOKIE)) {
      writeCookie(VISITOR_COOKIE, crypto.randomUUID());
    }

    if (!readCookie(SOURCE_COOKIE)) {
      const fromParam = parseTrafficSource(params.get("src"));
      // Sin marca de la plataforma, la visita llegó por fuera: el link
      // que compartió el fotógrafo, o una búsqueda externa.
      writeCookie(SOURCE_COOKIE, fromParam === "PLATFORM" ? "PLATFORM" : "DIRECT");
    }
  }, [params]);

  return null;
}
