/**
 * Cómo se llama el producto y dónde vive, que hoy no son lo mismo.
 *
 * Estamos en el medio de un rebrand: la marca que se anuncia es encontrate.app
 * —hay un aviso en el panel y una pregunta en las de siempre— pero el sitio
 * sigue estando en cuervito.app, y encontrate.app TODAVÍA NO RESUELVE.
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
export const SITIO = "https://cuervito.app";
