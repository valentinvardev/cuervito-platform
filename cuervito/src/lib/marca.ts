/**
 * Cómo se llama el producto y dónde vive, que hoy no son lo mismo.
 *
 * El rebrand está hecho: encontrate.app ya resuelve y sirve la app. Se deja
 * la separación igual, porque cuervito.app sigue vivo y respondiendo: está en
 * los mails ya enviados y en los links que la gente guardó.
 *
 * Eso ya había producido un error real: tres pies de página públicos —la
 * tienda, el perfil del fotógrafo y la página de entrega— tenían
 * `href="https://encontrate.app"` escrito a mano. El que compraba una foto y
 * hacía click terminaba en un error de DNS del navegador.
 *
 * Por eso están separadas: NOMBRE es lo que se lee, SITIO es a dónde se va, y
 * mientras dure la transición no coinciden. El día que el dominio esté
 * apuntando, se cambia SITIO acá y no hay que salir a buscar los links.
 */

/** El nombre que se muestra. Lo que la gente lee. */
export const NOMBRE = "encontrate.app";

/** El dominio que de verdad responde. Todo href sale de acá. */
export const SITIO = "https://encontrate.app";
