"use client";

import { useEffect, useRef, useState } from "react";

import { Entrega } from "~/app/descarga/[token]/encontrate/entrega";
import { EncontrateShell } from "~/app/[slug]/[eventSlug]/encontrate/shell";
import { guion, type Paso } from "./guion";

type Foto = {
  id: string;
  /** Con marca de agua. Es la de la vitrina, antes de pagar. */
  previewUrl: string;
  /** Sin marca de agua. Es la de la entrega, después de pagar. */
  limpiaUrl: string;
  bibNumbers: string | null;
  width: number | null;
  height: number | null;
  filename: string;
};

/**
 * La demo: la interfaz de verdad operándose sola, para grabar la pantalla.
 *
 * Renderiza los MISMOS componentes que ve el atleta —la tienda y la entrega, sin
 * copias ni maquetas— y los maneja tocando el DOM, el mismo botón que tocaría
 * una persona. Por eso sigue siendo la interfaz real: si mañana el botón de
 * agregar cambia, la demo lo sigue en vez de mostrar una versión vieja dibujada
 * aparte.
 *
 * Dos cosas que el guion NO hace de verdad, y el porqué:
 *
 * · No aprieta "Pagar con Mercado Pago". Ese botón llama al checkout y crearía
 *   una venta real con datos inventados cada vez que se ensaya la toma. En su
 *   lugar marca el botón como apretado y pasa a la entrega, que es exactamente
 *   lo que vería el comprador.
 *
 * · Las descargas van en modo simulado. Sin un token de verdad, pedirlas
 *   devolvería error justo en el cierre del video.
 *
 * El resto —buscar el dorsal, filtrar, abrir el visor, agregar al carrito,
 * llenar los datos, la animación de pago confirmado— es el código de producción
 * haciendo su trabajo.
 */
export function Demo({
  dorsal,
  tienda,
  fotos,
  fotografo,
  evento,
}: {
  /** El dorsal que escribe el guion. Sale de una foto real del evento. */
  dorsal: string | null;
  tienda: React.ComponentProps<typeof EncontrateShell>;
  fotos: Foto[];
  fotografo: React.ComponentProps<typeof Entrega>["fotografo"];
  evento: string;
}) {
  const [fase, setFase] = useState<"tienda" | "entrega">("tienda");
  const [paso, setPaso] = useState(0);
  const [rotulo, setRotulo] = useState<string | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const cancelado = useRef(false);

  // Se puede apagar con ?rotulos=no si en la edición molestan. Se lee en un
  // efecto porque en el servidor no hay location, y decidirlo al renderizar
  // dejaría el HTML del servidor distinto al del cliente.
  const [conRotulos, setConRotulos] = useState(true);
  useEffect(() => {
    setConRotulos(new URLSearchParams(window.location.search).get("rotulos") !== "no");
  }, []);
  const pasos = guion(dorsal);

  useEffect(() => {
    cancelado.current = false;
    void correr();
    return () => {
      cancelado.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuelta]);

  const dormir = (ms: number) =>
    new Promise<void>((r) => setTimeout(r, ms));

  async function correr() {
    setFase("tienda");
    setPaso(0);
    setRotulo(null);
    // Un respiro antes de arrancar, para poder empezar a grabar.
    await dormir(600);

    for (let i = 0; i < pasos.length; i++) {
      if (cancelado.current) return;
      setPaso(i);
      const p = pasos[i]!;
      await ejecutar(p);
      if (cancelado.current) return;
    }
  }

  async function ejecutar(p: Paso) {
    if (p.tipo === "esperar") return dormir(p.ms);

    if (p.tipo === "entregar") {
      // El botón de pagar se marca como apretado un instante: en el video tiene
      // que verse que alguien lo tocó, aunque no se llame al checkout.
      const btn = document.querySelector<HTMLElement>(".et-cajon-f .et-btn-lleno");
      if (btn) {
        btn.setAttribute("data-demo-apretado", "1");
        await dormir(220);
        btn.removeAttribute("data-demo-apretado");
      }
      setRotulo("paga");
      await dormir(500);
      setFase("entrega");
      // La entrega arranca con su animación de pago confirmado; después de eso,
      // una descarga y la demo vuelve a empezar para poder hacer otra toma.
      await dormir(4600);
      await tocar(".eg-baja", 0);
      await dormir(2600);
      setVuelta((v) => v + 1);
      return;
    }

    if (p.tipo === "tocar") {
      setRotulo(p.rotulo);
      return tocar(p.sel, p.indice ?? 0);
    }

    if (p.tipo === "escribir") return escribir(p.sel, p.texto, p.porLetra ?? 120);
  }

  async function tocar(sel: string, indice: number) {
    const els = document.querySelectorAll<HTMLElement>(sel);
    const el = els[indice];
    if (!el) return;
    // Un halo antes del click. Sin él, en el video las cosas cambian solas y no
    // se entiende qué se tocó: la mano no está para mostrarlo.
    el.setAttribute("data-demo-toque", "1");
    await dormir(260);
    el.click();
    await dormir(140);
    el.removeAttribute("data-demo-toque");
  }

  /**
   * Escribe letra por letra en un input de React.
   *
   * Asignar `.value` a mano no alcanza: React guarda su propio valor y no se
   * entera del cambio, así que el campo se ve escrito pero el componente sigue
   * creyendo que está vacío y la grilla no filtra. Hay que usar el setter nativo
   * del prototipo y después disparar el evento `input`, que es lo que React
   * escucha.
   */
  async function escribir(sel: string, texto: string, porLetra: number) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (!el) return;
    el.focus();
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    const setter = desc?.set?.bind(el);
    for (let i = 1; i <= texto.length; i++) {
      if (cancelado.current) return;
      setter?.(texto.slice(0, i));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await dormir(porLetra);
    }
  }

  return (
    <div className="demo" data-fase={fase}>
      {fase === "tienda" ? (
        <EncontrateShell {...tienda} />
      ) : (
        <Entrega
          token="demo"
          comprador="Lucía Fernández"
          evento={evento}
          fotografo={fotografo}
          fotos={fotos.map((f) => ({
            id: f.id,
            filename: f.filename,
            bibNumbers: f.bibNumbers,
            // La limpia: acá ya pagó. Con la de la vitrina, el cierre del video
            // mostraba la compra todavía marcada.
            previewUrl: f.limpiaUrl,
          }))}
          recienPagado
          simulado
        />
      )}

      {/* El rótulo de lo que está pasando. Se puede apagar con ?rotulos=no si en
          la edición molesta; por defecto está porque ayuda a que el paso se
          entienda sin narración. */}
      {conRotulos && rotulo && <div className="demo-rotulo">{rotulo}</div>}

      <div className="demo-barra" style={{ width: `${(paso / pasos.length) * 100}%` }} />
    </div>
  );
}
