/**
 * Lo que cobramos según cómo se encuentren las fotos.
 *
 * En un módulo normal y no en acciones.ts: el asistente necesita mostrar los
 * números mientras el fotógrafo elige, y todo lo que se exporta desde un
 * archivo "use server" tiene que ser async y queda publicado como endpoint.
 *
 * Acá y no en una variable de entorno porque no es configuración de despliegue:
 * es el trato con el fotógrafo, y cambiarlo tiene que verse en el historial.
 */
export const COMISION_CON = 10;
export const COMISION_SIN = 5;
