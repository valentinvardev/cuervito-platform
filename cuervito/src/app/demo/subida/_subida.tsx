"use client";

import { useEffect, useRef, useState } from "react";

import { Pantalla } from "~/app/v2/evento/[id]/_pantalla";
import { Celebracion } from "../_piezas";

/**
 * Los tiempos, todos juntos.
 *
 * Es lo único que se va a retocar mientras se graba: si un paso pasa demasiado
 * rápido para que se lea en el video, se cambia un número acá y nada más.
 */
const T = {
  /** Respiro inicial con el panel vacío, para arrancar a grabar. */
  arranque: 1500,
  /** Cuánto se queda el halo sobre el recuadro antes de "soltar". */
  toque: 700,
  /** Tope de espera a que cierre la subida, por si algo se traba. */
  subida: 60_000,
  /** Pausa entre que termina la subida y aparecen las fotos. */
  antesDeRevelar: 700,
  /** Cuánto tarda en reconocerse cada foto. */
  porReconocida: 130,
  /** Beat con la grilla ya completa. */
  despues: 1600,
  /** Cuánto tarda cada dígito del dorsal que se busca al final. */
  porLetra: 280,
  /** Cuánto se queda mostrando el resultado de la búsqueda. */
  resultado: 2400,
  /** Cuánto dura la pantalla de cierre. */
  cierre: 3400,
  /** Pausa antes de volver a empezar. */
  antesDeVolver: 600,
};

type Foto = {
  id: string;
  url: string | null;
  bib: string | null;
  vendida: boolean;
  ventas: number;
  caras: number;
  reconocida: boolean;
};

type Props = React.ComponentProps<typeof Pantalla>;

/**
 * La demo de la subida: el panel del evento operándose solo, para grabar.
 *
 * Renderiza la Pantalla DE VERDAD —el mismo componente que usa /v2/evento/[id],
 * sin copias— y le va cambiando las props: arranca con cero fotos y termina con
 * el álbum entero reconocido. Todo lo que se ve reaccionar es el código de
 * producción: el soltador, la barra de subida, la de reconocimiento, la grilla
 * con su paginado y la búsqueda por dorsal.
 *
 * Lo que NO es real, y el porqué:
 *
 * · La subida no toca la red (`simulado`). Subir de verdad crearía fotos
 *   duplicadas en el evento cada vez que se ensaya la toma, y encima el video
 *   quedaría atado a la velocidad de la conexión del momento.
 *
 * · El reconocimiento no corre: se revela el resultado que las fotos YA tienen
 *   en la base, de a una. Rekognition tarda minutos y cuesta plata por foto.
 *
 * El álbum es preexistente en ese sentido: las fotos ya están en S3 con su
 * dorsal leído, y la demo las va destapando al ritmo que se lee en pantalla.
 */
export function Subida({ evento, fotos, ...resto }: Props & { fotos: Foto[] }) {
  const [reveladas, setReveladas] = useState(0);
  const [reconocidas, setReconocidas] = useState(0);
  const [fin, setFin] = useState(false);
  const [vuelta, setVuelta] = useState(0);
  const cancelado = useRef(false);

  // Las fotos que se muestran, con el estado que les toca en este instante: las
  // que todavía no se reconocieron van sin dorsal y sin caras, que es como se
  // ven de verdad mientras Rekognition las procesa.
  const visibles = fotos
    .slice(0, reveladas)
    .map((f, i) => (i < reconocidas ? f : { ...f, bib: null, caras: 0, reconocida: false }));
  const conDorsal = fotos.slice(0, reconocidas).filter((f) => f.bib?.trim()).length;

  // El dorsal que se busca al cerrar. Sale de una foto real, así que la
  // búsqueda encuentra algo en vez de quedar en cero.
  const dorsal = fotos.find((f) => f.bib?.trim())?.bib?.split(",")[0]?.trim() ?? null;

  useEffect(() => {
    cancelado.current = false;
    void correr();
    return () => {
      cancelado.current = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuelta]);

  const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  /** Espera a que algo del DOM se cumpla, con tope. Devuelve si se cumplió. */
  async function esperarA(cond: () => boolean, tope: number) {
    const hasta = Date.now() + tope;
    while (Date.now() < hasta) {
      if (cancelado.current) return false;
      if (cond()) return true;
      await dormir(120);
    }
    return false;
  }

  async function correr() {
    setReveladas(0);
    setReconocidas(0);
    setFin(false);
    await dormir(T.arranque);
    if (cancelado.current) return;

    // 1) Suelta la carpeta del evento.
    const recuadro = document.querySelector<HTMLElement>(".soltar");
    recuadro?.setAttribute("data-demo-toque", "1");
    // La clase "encima" es la que el soltador se pone solo cuando hay algo
    // arrastrado arriba. Ponérsela hace que en el video se vea el recuadro
    // iluminado justo antes de que caigan los archivos.
    recuadro?.classList.add("encima");
    await dormir(T.toque);
    recuadro?.removeAttribute("data-demo-toque");
    recuadro?.classList.remove("encima");
    window.dispatchEvent(new CustomEvent("demo:soltar", { detail: archivos(fotos.length) }));

    // 2) La subida corre sola. Se espera a que el soltador diga "Listo", que en
    //    el DOM es su etapa sin la clase de lenta.
    await esperarA(() => {
      const et = document.querySelector(".panel-s .proc .etapa");
      return !!et && !et.classList.contains("lenta");
    }, T.subida);
    if (cancelado.current) return;

    // 3) Las fotos aparecen. Todas juntas: recién subidas ya existen, lo que
    //    falta es que las reconozcan.
    await dormir(T.antesDeRevelar);
    setReveladas(fotos.length);
    await dormir(T.antesDeRevelar);
    if (cancelado.current) return;

    // 4) El reconocimiento, de a una. Es la parte que explica el producto: cada
    //    foto pasa de "todavía procesando" a tener su dorsal y sus caras.
    for (let i = 1; i <= fotos.length; i++) {
      if (cancelado.current) return;
      setReconocidas(i);
      await dormir(T.porReconocida);
    }
    await dormir(T.despues);
    if (cancelado.current) return;

    // 5) Y ahora se pueden buscar. Cierra la idea: subir sirve para que alguien
    //    las encuentre.
    if (dorsal) {
      await escribir(".barra input.inp", dorsal, T.porLetra);
      await dormir(T.resultado);
      await escribir(".barra input.inp", "", 0);
      await dormir(500);
    }
    if (cancelado.current) return;

    // 6) El cierre, y a empezar de nuevo para poder hacer otra toma sin
    //    recargar. El soltador se deja como estaba ANTES de tapar la pantalla,
    //    así el reinicio no se ve.
    setFin(true);
    await dormir(T.cierre);
    if (cancelado.current) return;
    document.querySelector<HTMLElement>(".panel-s .proc .btn-ghost")?.click();
    await dormir(T.antesDeVolver);
    if (cancelado.current) return;
    setVuelta((v) => v + 1);
  }

  /**
   * Los archivos que se "sueltan".
   *
   * Van vacíos y con nombre de cámara. El contenido no importa: en modo
   * simulado la subida no lee el archivo, sólo recorre sus estados. Lo que sí
   * importa es el tipo, porque el filtro de formatos del soltador es el de
   * verdad y descartaría cualquier otra cosa.
   */
  function archivos(cuantos: number) {
    return Array.from(
      { length: cuantos },
      (_, i) =>
        new File([new Uint8Array(1)], `DSC_${String(4021 + i).padStart(4, "0")}.jpg`, {
          type: "image/jpeg",
        }),
    );
  }

  /**
   * Escribe en un input de React, letra por letra.
   *
   * Asignar `.value` a mano no alcanza: React guarda su propio valor y no se
   * entera del cambio, así que el campo se ve escrito pero el componente sigue
   * creyendo que está vacío y la grilla no filtra. Hay que usar el setter
   * nativo del prototipo y después disparar `input`, que es lo que React
   * escucha. Con texto vacío, limpia.
   */
  async function escribir(sel: string, texto: string, porLetra: number) {
    const el = document.querySelector<HTMLInputElement>(sel);
    if (!el) return;
    const desc = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
    const setter = desc?.set?.bind(el);
    if (texto === "") {
      setter?.("");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    el.focus();
    for (let i = 1; i <= texto.length; i++) {
      if (cancelado.current) return;
      setter?.(texto.slice(0, i));
      el.dispatchEvent(new Event("input", { bubbles: true }));
      await dormir(porLetra);
    }
    el.blur();
  }

  // La barra de arriba. No es exacta y no hace falta que lo sea: está para que
  // en el video se vea que la toma avanza y cuánto le falta.
  const pasos = fotos.length + 4;
  const hechos = reconocidas + (reveladas > 0 ? 2 : 0) + (fin ? 2 : 0);

  return (
    <div className="demo" data-fase="panel">
      <Pantalla
        {...resto}
        evento={{ ...evento, total: reveladas, reconocidas, conDorsal }}
        fotos={visibles}
        simulado
      />

      {/* Sin <Marca />: el panel ya trae el isotipo en su propia barra. La
          superposición de la demo existe para la tienda, cuyo encabezado es
          del fotógrafo y no lleva el nuestro. Acá sumaba un segundo ícono. */}
      <div className="demo-barra" style={{ width: `${Math.min(100, (hechos / pasos) * 100)}%` }} />

      {fin && (
        <Celebracion
          titulo="¡Subiste tus fotos!"
          detalle={`${fotos.length} fotos reconocidas y publicadas. Ya se pueden buscar por dorsal o por cara.`}
        />
      )}
    </div>
  );
}
