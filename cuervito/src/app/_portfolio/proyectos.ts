import type { FotoSitio } from "./store";

/**
 * Las fotos del portfolio agrupadas en "proyectos", en el orden en que
 * llegan. En encontrate un proyecto es un grupo del portfolio, que nace de un
 * evento (Maratón de la Ciudad, Trail del Champaquí). Halcyon los lista como
 * índice; las otras plantillas los usan para los epígrafes.
 *
 * Las fotos sin grupo van todas a uno solo, con el título que se pase.
 */
export type Proyecto = {
  id: string;
  no: string;
  title: string;
  year: string;
  photos: { id: string; src: string; title: string; date: string }[];
};

export function agruparProyectos(fotos: FotoSitio[], sinGrupo = "Trabajo"): Proyecto[] {
  const porGrupo = new Map<string, Proyecto>();
  fotos.forEach((f, i) => {
    const grupo = f.group?.trim();
    const titulo = grupo?.length ? grupo : sinGrupo;
    let p = porGrupo.get(titulo);
    if (!p) {
      p = { id: `p${porGrupo.size}`, no: "", title: titulo, year: "", photos: [] };
      porGrupo.set(titulo, p);
    }
    p.photos.push({ id: `f${i}`, src: f.src, title: f.title ?? "", date: f.date ?? "" });
  });
  return [...porGrupo.values()].map((p, i) => ({
    ...p,
    no: String(i + 1).padStart(2, "0"),
    // El año del proyecto es el de su foto más reciente que lo tenga.
    year: p.photos.map((f) => f.date.slice(0, 4)).filter(Boolean).sort().at(-1) ?? "",
  }));
}
