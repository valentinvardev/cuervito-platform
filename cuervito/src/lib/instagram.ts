/**
 * El usuario de Instagram a partir de lo que haya cargado el fotógrafo.
 *
 * El campo del perfil pide el usuario con "instagram.com/" adelante, pero la
 * gente pega lo que tiene a mano: "@usuario", el link entero copiado de la app,
 * con "www." o con "?igsh=…" atrás. Antes sólo se sacaba la arroba, así que un
 * link pegado armaba instagram.com/https://… y llevaba a una página de error.
 *
 * Devuelve null si lo que queda no puede ser un usuario (letras, números,
 * puntos y guiones bajos, hasta 30): mejor no mostrar el link que mostrar uno
 * roto.
 */
export function usuarioInstagram(valor: string | null | undefined): string | null {
  if (!valor) return null;
  let u = valor.trim().replace(/^@/, "");
  const enlace = /^(https?:\/\/)?(www\.|m\.)?instagram\.com\//i;
  if (enlace.test(u)) u = u.replace(enlace, "");
  // Un link a cualquier otro lado no es un usuario: sin esto, de
  // "https://otrolado.com/juan" quedaba "otrolado.com".
  else if (/[/:]/.test(u)) return null;
  u = u.replace(/^@/, "").replace(/[/?#].*$/, "");
  return /^[A-Za-z0-9._]{1,30}$/.test(u) ? u : null;
}
