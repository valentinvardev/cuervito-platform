import "server-only";

import { getTemplate } from "~/lib/storefront-templates";

import * as cuervito from "./email";
import * as encontrate from "./email-encontrate";

/**
 * Qué juego de plantillas de mail usar.
 *
 * Sigue la plantilla del fotógrafo, la misma regla que ya usan su tienda y su
 * página de entrega. El comprador recibe un mail que se parece a la página
 * donde compró: si la tienda dice encontrate y el mail dice cuervito, por un
 * momento no sabe si le escribió el fotógrafo o alguien más.
 *
 * Por eso no se cambian los siete lugares de una: mientras haya cuentas con la
 * plantilla vieja, sus compradores tienen que seguir recibiendo los mails
 * viejos. El día que no quede ninguna, esto devuelve siempre lo mismo y se
 * puede borrar.
 *
 * Las firmas de los dos módulos son intercambiables a propósito. Si alguna vez
 * dejan de serlo, TypeScript lo dice acá y no en producción.
 */
export function mailsDe(storefrontTemplate: string | null | undefined) {
  return getTemplate(storefrontTemplate).layout === "encontrate" ? encontrate : cuervito;
}
