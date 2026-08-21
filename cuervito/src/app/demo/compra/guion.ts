/**
 * El guion de la demo: qué toca, en qué orden y con cuánta pausa.
 *
 * Está aparte del componente por una razón práctica: los tiempos son lo único
 * que se va a retocar mientras se graba. Si un paso pasa muy rápido para que se
 * lea en el video, se cambia un número acá y no se toca nada más.
 *
 * Los pasos se ejecutan tocando el DOM de verdad —el mismo botón que tocaría
 * una persona— y no metiéndole estado a los componentes por la ventana. Así lo
 * que se graba es la interfaz real reaccionando, que es lo que se pidió: si
 * mañana el botón de agregar cambia de lugar, la demo lo sigue.
 */
export type Paso =
  | { tipo: "esperar"; ms: number }
  | { tipo: "tocar"; sel: string; indice?: number; rotulo: string }
  | { tipo: "escribir"; sel: string; texto: string; porLetra?: number }
  | { tipo: "entregar" };

/** Cuánto se queda quieto cada paso para que se lea en el video. */
const PAUSA = 900;

export function guion(dorsal: string | null): Paso[] {
  return [
    { tipo: "esperar", ms: 1400 },

    // 1) Busca su dorsal. Sin subir ninguna imagen: se escribe el número, que
    //    es además lo que hace la mayoría de la gente que llega con el papel
    //    todavía puesto. El número sale de una foto real del evento, así que la
    //    búsqueda encuentra algo; si el evento no lee dorsales, este paso no
    //    existe y el video arranca directo por la galería.
    ...(dorsal
    ? ([
        { tipo: "escribir", sel: ".et-dorsal input", texto: dorsal, porLetra: 260 },
        { tipo: "esperar", ms: 1600 },
      ] as Paso[])
    : []),

    // 2) Mira una en grande y la agrega desde ahí.
    { tipo: "tocar", sel: ".et-foto", indice: 0, rotulo: "abre la primera foto" },
    { tipo: "esperar", ms: 1500 },
    { tipo: "tocar", sel: ".et-visor-pie .et-btn", rotulo: "la agrega al carrito" },
    { tipo: "esperar", ms: 800 },
    { tipo: "tocar", sel: ".et-visor-nav.der", rotulo: "pasa a la siguiente" },
    { tipo: "esperar", ms: 1200 },
    { tipo: "tocar", sel: ".et-visor-pie .et-btn", rotulo: "agrega la segunda" },
    { tipo: "esperar", ms: 800 },
    { tipo: "tocar", sel: ".et-visor-x", rotulo: "cierra el visor" },
    { tipo: "esperar", ms: PAUSA },

    // 3) Abre el carrito y revisa.
    { tipo: "tocar", sel: ".et-carrito button", rotulo: "abre el carrito" },
    { tipo: "esperar", ms: 1800 },
    { tipo: "tocar", sel: ".et-cajon-f .et-btn-lleno", rotulo: "continuar" },
    { tipo: "esperar", ms: PAUSA },

    // 4) Sus datos.
    { tipo: "escribir", sel: '.et-cajon-b input[type="email"]', texto: "lucia@gmail.com", porLetra: 70 },
    { tipo: "esperar", ms: 400 },
    { tipo: "escribir", sel: ".et-cajon-b input:not([type=email])", texto: "Lucía Fernández", porLetra: 70 },
    { tipo: "esperar", ms: 1100 },

    // 5) Paga. Acá NO se toca el botón de verdad: llamaría al checkout y crearía
    //    una venta real con datos inventados. Se marca el botón como apretado y
    //    el guion pasa a la entrega, que es exactamente lo que vería el
    //    comprador.
    { tipo: "entregar" },
  ];
}
