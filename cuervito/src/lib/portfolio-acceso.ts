/**
 * Quién puede usar Portfolio. Mientras se termina, sólo los admins.
 *
 * Es EL interruptor: lo leen el riel (para mostrar el ítem), el control de
 * acceso de las pantallas y las acciones del servidor. El día que se abra a
 * todos se cambia acá y en ningún otro lado. La vez que un candado así quedó
 * copiado en cada pantalla, al abrirlo se olvidó uno y el panel se rompía
 * para todos los que no eran admin (ver .mentor/patrones.md).
 */
export function puedeUsarPortfolio(rol: string | null | undefined): boolean {
  return rol === "ADMIN";
}

/** Mientras sea sólo para admins, el riel lo marca, para que no se confunda con lo publicado. */
export const PORTFOLIO_ROTULO: string | null = "Admin";
