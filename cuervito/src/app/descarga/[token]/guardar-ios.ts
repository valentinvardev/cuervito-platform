/**
 * Guardar una foto en iOS.
 *
 * Salió de descarga-client.tsx cuando la entrega nueva necesitó lo mismo. No es
 * código que convenga tener dos veces: adentro hay una rareza de iOS que si se
 * copia mal deja al comprador creyendo que la descarga falló cuando en realidad
 * guardó bien.
 *
 * El problema de fondo: en iOS, un <a download> deja el archivo en la app
 * Archivos, no en el carrete. Para que aparezca en Fotos —que es donde el
 * atleta lo busca— hay que pasar por la hoja de compartir del sistema, que es
 * la única vía que ofrece "Guardar imagen".
 */

/** Si el navegador puede compartir ARCHIVOS, no sólo links. */
export function puedeCompartirArchivos(): boolean {
  if (typeof navigator === "undefined") return false;
  if (!("share" in navigator) || !("canShare" in navigator)) return false;
  try {
    const prueba = new File([""], "prueba.jpg", { type: "image/jpeg" });
    return (navigator as Navigator & { canShare: (d: ShareData) => boolean }).canShare({
      files: [prueba],
    });
  } catch {
    return false;
  }
}

export function esIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS 13+ se hace pasar por Mac; el touch lo delata.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export type ResultadoGuardado = "guardada" | "mantener-apretado" | "error";

/**
 * Baja el original y abre la hoja de compartir.
 *
 * Devuelve:
 *   guardada          — la hoja se abrió. Cualquier rechazo posterior de
 *                       navigator.share se toma como éxito: iOS tiene un error
 *                       conocido por el que tira AbortError incluso después de
 *                       que el usuario tocó "Guardar foto". Tratarlo como fallo
 *                       le diría "no se pudo" a alguien que ya la tiene.
 *   mantener-apretado — no hay Web Share (iOS viejo, o no es Safari). Al
 *                       comprador hay que decirle que mantenga apretada la foto.
 *   error             — no se pudo ni bajar el archivo.
 */
export async function guardarConHojaDeCompartir(
  url: string,
  nombre: string,
): Promise<ResultadoGuardado> {
  if (!puedeCompartirArchivos()) return "mantener-apretado";
  let seAbrio = false;
  try {
    const r = await fetch(url);
    const blob = await r.blob();
    const archivo = new File([blob], nombre, { type: blob.type || "image/jpeg" });
    seAbrio = true;
    await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
      files: [archivo],
    });
    return "guardada";
  } catch {
    return seAbrio ? "guardada" : "error";
  }
}

/**
 * Compartir el link de la entrega.
 *
 * Con la hoja del sistema donde exista —es lo que la gente espera en el
 * teléfono— y copiando al portapapeles donde no. Devuelve qué pasó para poder
 * decir "copiado" sólo cuando de verdad se copió.
 */
export async function compartirLink(
  url: string,
  titulo: string,
): Promise<"compartido" | "copiado" | "error"> {
  if (typeof navigator === "undefined") return "error";
  if ("share" in navigator) {
    try {
      await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
        title: titulo,
        url,
      });
      return "compartido";
    } catch {
      // Cancelar la hoja también cae acá; se sigue al portapapeles, que no
      // molesta a nadie.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copiado";
  } catch {
    return "error";
  }
}
