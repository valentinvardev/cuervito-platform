import type { ReactElement } from "react";

import type { FormatoId, PlantillaId } from "./formatos";

/**
 * El dibujo de cada plantilla: TODO menos la foto.
 *
 * La foto no pasa por acá y no es un detalle de implementación, es la regla
 * del producto: lo que vende el fotógrafo es la foto de una persona real, así
 * que la foto se compone aparte con sharp y sale con los píxeles que entraron.
 * Acá se dibuja lo que sí es nuestro —degradado, texto, logo— sobre un fondo
 * transparente, y después se apoya encima.
 *
 * Se usa satori porque hay que MAQUETAR texto: un título que no sabe cuántas
 * líneas va a ocupar, alineado con lo de al lado. Eso es lo único que sharp no
 * hace. Y satori devuelve las letras convertidas en trazos, así que el SVG que
 * sale no depende de que haya fuentes instaladas en el servidor.
 */

export type DatosHistoria = {
  evento: string;
  /** "12 de mayo", ya formateada. Null si el evento no tiene fecha. */
  fecha: string | null;
  lugar: string | null;
  disciplina: string | null;
  fotos: number;
  /** "$1.500", ya formateado. */
  precio: string;
  /** La dirección de la tienda, sin el protocolo. */
  direccion: string;
  /** El logo del fotógrafo como data URI, o null si no subió ninguno. */
  logo: string | null;
  /** El color de marca, en hex. */
  color: string;
};

/** Blanco o negro, el que se lea sobre ese fondo. */
export function tintaSobre(hex: string): string {
  const c = hex.replace("#", "");
  const n =
    c.length === 3
      ? c
          .split("")
          .map((x) => x + x)
          .join("")
      : c;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  // Luminancia relativa aproximada. El 0,6 es el corte que en la práctica
  // separa los naranjas y amarillos —que piden tinta— de los azules y verdes
  // oscuros, que piden papel.
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.6 ? "#12110F" : "#FFFFFF";
}

/**
 * El color de marca, si se lee sobre el degradado oscuro de la cubierta.
 *
 * Un fotógrafo con la marca en bordó o azul noche tiene todo el derecho, pero
 * ese color sobre un degradado casi negro no se ve, y el volanta es justo el
 * renglón que tiene que frenar el pulgar. Cuando no llega, gana el blanco: es
 * preferible perder el color de marca en dos palabras que perder las dos
 * palabras.
 */
function acentoSobreOscuro(hex: string): string {
  const c = hex.replace("#", "");
  const n = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum < 0.34 ? "#FFFFFF" : hex;
}

/** Los renglones sueltos de abajo de todo, separados por puntos. */
function meta(d: DatosHistoria): string {
  return [d.disciplina, d.fecha, d.lugar].filter(Boolean).join(" · ");
}

/**
 * El bloque de texto que comparten las dos plantillas.
 *
 * El orden no es decorativo. Primero el dato que hace parar el pulgar —"ya
 * están tus fotos"—, después de qué evento, y al final cómo llegar. Al revés
 * el atleta lee el nombre de una carrera que no corrió y sigue de largo.
 */
function Texto({
  d,
  tinta,
  acento,
  escala,
}: {
  d: DatosHistoria;
  tinta: string;
  /** El color del volanta. Lo decide la plantilla: sobre el color de marca no
   *  puede ser el color de marca. */
  acento: string;
  escala: number;
}) {
  const tenue = tinta === "#FFFFFF" ? "rgba(255,255,255,.72)" : "rgba(18,17,15,.66)";
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div
        style={{
          display: "flex",
          fontFamily: "Outfit",
          fontSize: 26 * escala,
          fontWeight: 600,
          letterSpacing: 4 * escala,
          textTransform: "uppercase",
          color: acento,
        }}
      >
        Ya están tus fotos
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 18 * escala,
          fontFamily: "Unbounded",
          fontSize: 74 * escala,
          fontWeight: 800,
          lineHeight: 1.02,
          letterSpacing: -3 * escala,
          textTransform: "uppercase",
          color: tinta,
        }}
      >
        {d.evento}
      </div>

      {meta(d) && (
        <div
          style={{
            display: "flex",
            marginTop: 20 * escala,
            fontFamily: "Outfit",
            fontSize: 30 * escala,
            color: tenue,
          }}
        >
          {meta(d)}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginTop: 34 * escala,
          fontFamily: "Outfit",
          fontSize: 32 * escala,
          fontWeight: 600,
          color: tinta,
        }}
      >
        <span>{d.fotos.toLocaleString("es-AR")} fotos</span>
        <span style={{ margin: `0 ${14 * escala}px`, color: tenue, fontWeight: 400 }}>·</span>
        <span>desde {d.precio}</span>
      </div>
    </div>
  );
}

/** La firma de abajo: el logo si lo hay, y siempre la dirección. */
function Pie({ d, tinta, escala }: { d: DatosHistoria; tinta: string; escala: number }) {
  const tenue = tinta === "#FFFFFF" ? "rgba(255,255,255,.62)" : "rgba(18,17,15,.55)";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 40 * escala,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Outfit",
          fontSize: 30 * escala,
          fontWeight: 600,
          color: tinta,
        }}
      >
        {d.direccion}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {d.logo && <img src={d.logo} alt="" height={52 * escala} style={{ objectFit: "contain" }} />}
      {!d.logo && (
        <div style={{ display: "flex", fontFamily: "Outfit", fontSize: 26 * escala, color: tenue }}>
          Buscá tu dorsal
        </div>
      )}
    </div>
  );
}

export function dibujar({
  plantilla,
  formato,
  ancho,
  alto,
  d,
}: {
  plantilla: PlantillaId;
  formato: FormatoId;
  ancho: number;
  alto: number;
  d: DatosHistoria;
}): ReactElement {
  // Todo se mide contra 1080 de ancho, así que un formato más angosto no
  // necesita una segunda tabla de tamaños.
  const escala = ancho / 1080;
  // El posteo es más bajo que la historia y el mismo margen ahí se come la
  // foto: en 4:5 hay 570px menos de alto para repartir.
  const margen = (formato === "historia" ? 78 : 62) * escala;

  if (plantilla === "placa") {
    const tinta = tintaSobre(d.color);
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          width: ancho,
          height: alto,
          padding: margen,
          // El fondo lo pone sharp; acá va transparente para no tapar el hueco
          // donde entra la foto.
          backgroundColor: "transparent",
        }}
      >
        {/* Sobre el color de marca el volanta va en la misma tinta que el
            resto: pintarlo del color de marca sería pintarlo del color del
            fondo. La marca ya está puesta, es el fondo entero. */}
        <Texto d={d} tinta={tinta} acento={tinta} escala={escala} />
        <Pie d={d} tinta={tinta} escala={escala} />
      </div>
    );
  }

  // Cubierta: la foto está abajo de todo, así que el texto necesita su propio
  // piso. El degradado arranca transparente arriba y no de golpe: un borde
  // duro sobre una foto se ve como una barra pegada encima.
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        width: ancho,
        height: alto,
        padding: margen,
        backgroundImage:
          "linear-gradient(to bottom, rgba(10,9,8,0) 38%, rgba(10,9,8,.62) 62%, rgba(10,9,8,.94) 100%)",
      }}
    >
      <Texto d={d} tinta="#FFFFFF" acento={acentoSobreOscuro(d.color)} escala={escala} />
      <Pie d={d} tinta="#FFFFFF" escala={escala} />
    </div>
  );
}
