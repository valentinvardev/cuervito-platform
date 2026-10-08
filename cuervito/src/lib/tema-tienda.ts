/**
 * El modo oscuro de la plantilla de encontrate.
 *
 * Lo elige el que mira, no el fotógrafo: la plantilla es clara y ésa es la
 * página que el fotógrafo armó; el oscuro es una preferencia de lectura, como
 * la del panel. Va en su propio atributo (`data-tienda`) y no en `data-theme`
 * porque ese otro lo maneja StorefrontTheme para las plantillas viejas, que
 * van siempre en oscuro, y tiene que volver a la preferencia del panel al
 * salir de la tienda.
 *
 * Lo leen el script del layout (antes de pintar, sin destello), StorefrontTheme
 * (en las navegaciones dentro de la app, donde ese script no vuelve a correr) y
 * el botón.
 */
export const CLAVE_TEMA_TIENDA = "encontrate-tienda-tema";

export const SCRIPT_TEMA_TIENDA = `try{if(localStorage.getItem('${CLAVE_TEMA_TIENDA}')==='oscura')document.documentElement.dataset.tienda='oscura'}catch(e){}`;

/**
 * Si el logo del fotógrafo es blanco o negro sobre transparente. Lo mide
 * server/logo-tono; la tienda invierte el que no contrasta con el fondo.
 */
export type TonoLogo = "claro" | "oscuro";
