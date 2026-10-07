import { Hash, ScanFace } from "lucide-react";
import { type CSSProperties } from "react";

import { AlVerse } from "./al-verse";

/**
 * El momento del producto: de todas las fotos del evento a las tuyas.
 *
 * No hay fotos de verdad adentro, a propósito. Una foto de un corredor
 * inventado en una plataforma que vende fotos de corredores reales es lo
 * primero que alguien nota. Son siluetas: la idea se entiende igual y no
 * promete una imagen que no existe.
 */

const TUYO = "1234";

/* Doce baldosas; las cuatro con el dorsal 1234 son las del atleta. Los otros
   números son cualquiera, pero fijos: si cambiaran en cada render, el HTML del
   servidor y el del navegador no coincidirían. */
const BALDOSAS = [
  { n: "1187" }, { n: TUYO }, { n: "512" }, { n: "2033" },
  { n: "877" }, { n: "1409" }, { n: TUYO }, { n: "96" },
  { n: TUYO }, { n: "1530" }, { n: "348" }, { n: TUYO },
];

export function Buscarse({ modo = "dorsal" }: { modo?: "dorsal" | "selfie" }) {
  const conDorsal = modo === "dorsal";
  return (
    <AlVerse
      className="ilus-buscarse"
      repetible
      etiqueta={
        conDorsal
          ? "Escribís tu número de dorsal y, de las 2.162 fotos del evento, quedan sólo las 4 tuyas."
          : "Te sacás una selfie y, de las 2.162 fotos del evento, quedan sólo las 4 en las que aparecés."
      }
    >
      <div className="bus-barra">
        <span className="bus-cuenta">
          <span className="bus-cuenta-a">2.162 fotos</span>
          <span className="bus-cuenta-b">4 son tuyas</span>
        </span>
        {conDorsal ? (
          <span className="bus-campo">
            <Hash />
            <span className="bus-tipeo">{TUYO}</span>
            <i className="bus-cursor" />
          </span>
        ) : (
          <span className="bus-campo">
            <span className="bus-selfie">
              <ScanFace />
              <i className="bus-escaneo" />
            </span>
            Tu selfie
          </span>
        )}
      </div>

      <div className="bus-grilla">
        {BALDOSAS.map((b, i) => (
          <span
            key={i}
            className={`bus-foto${b.n === TUYO ? " es" : ""}`}
            style={{ "--i": i } as CSSProperties}
          >
            <i className="bus-cabeza" />
            <i className="bus-torso">{conDorsal && <b>{b.n}</b>}</i>
          </span>
        ))}
      </div>
    </AlVerse>
  );
}
