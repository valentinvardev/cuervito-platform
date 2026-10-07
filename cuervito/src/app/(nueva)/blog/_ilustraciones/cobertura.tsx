import { Camera, Flag } from "lucide-react";

import { AlVerse } from "./al-verse";

/**
 * Dónde pararse en una carrera: la largada, un tramo intermedio y la llegada.
 *
 * El recorrido se dibuja y un corredor lo atraviesa; las cámaras aparecen
 * cuando él pasa por cada punto. El naranja va en la llegada, la única que es
 * obligatoria.
 */

/* El mismo trazo lo usan la línea y el corredor (offset-path). Si se cambia
   uno, se cambia el otro: por eso es una constante. */
const RUTA = "M 30 150 C 130 30, 230 40, 320 105 S 500 185, 610 60";

export function PuntosDeCobertura() {
  return (
    <AlVerse
      className="ilus-cobertura"
      etiqueta="Un recorrido de carrera con tres puntos para fotografiar: la largada, un tramo intermedio con buena luz y corredores espaciados, y la llegada, que es obligatoria."
    >
      <svg viewBox="0 0 640 200" className="cob-mapa">
        <path d={RUTA} className="cob-fondo" />
        <path d={RUTA} className="cob-ruta" pathLength={1} />
        <g className="cob-punto cob-p1" transform="translate(30 150)">
          <circle r="9" />
        </g>
        <g className="cob-punto cob-p2" transform="translate(320 105)">
          <circle r="9" />
        </g>
        <g className="cob-punto cob-p3" transform="translate(610 60)">
          <circle r="11" />
        </g>
        <circle className="cob-corredor" r="6" style={{ offsetPath: `path("${RUTA}")` }} />
      </svg>

      <ol className="cob-leyenda">
        <li className="cob-l1">
          <Flag />
          <b>Largada</b>
          <span>Todos juntos: sirve para el ambiente, poco para encontrarse.</span>
        </li>
        <li className="cob-l2">
          <Camera />
          <b>Tramo intermedio</b>
          <span>Buena luz y corredores espaciados: el dorsal se lee.</span>
        </li>
        <li className="cob-l3">
          <Camera />
          <b>Llegada</b>
          <span>Pasan todos y es la foto que más se compra. No se negocia.</span>
        </li>
      </ol>
    </AlVerse>
  );
}
