import {
  Banknote,
  Camera,
  CloudUpload,
  CreditCard,
  Download,
  Handshake,
  ScanFace,
  Search,
} from "lucide-react";
import { type CSSProperties } from "react";

import { AlVerse } from "./al-verse";

/**
 * Un recorrido en cuatro pasos. Los textos son fijos por recorrido —en el MDX
 * no se pueden pasar listas—, y elegir entre dos recorridos con nombre es más
 * claro que armarlos a mano en cada post.
 */

const RECORRIDOS = {
  atleta: {
    etiqueta: "Los cuatro pasos del atleta: elegís el evento, te buscás por dorsal o selfie, pagás con Mercado Pago y descargás.",
    pasos: [
      { Icono: Search, t: "Elegí tu evento", d: "Por nombre, ciudad o deporte" },
      { Icono: ScanFace, t: "Buscate", d: "Con tu dorsal o una selfie" },
      { Icono: CreditCard, t: "Pagá", d: "Con Mercado Pago, sin cuenta" },
      { Icono: Download, t: "Descargá", d: "Al instante, sin marca de agua" },
    ],
  },
  venta: {
    etiqueta: "Los cuatro momentos de una venta: arreglás con la organización, cubrís la llegada, subís todo junto y cobrás en el momento.",
    pasos: [
      { Icono: Handshake, t: "Antes", d: "Arreglá la difusión con la organización" },
      { Icono: Camera, t: "Durante", d: "Cubrí a todos, no sólo la punta" },
      { Icono: CloudUpload, t: "Después", d: "Subí todo junto, el mismo día" },
      { Icono: Banknote, t: "La venta", d: "Entra a tu Mercado Pago al instante" },
    ],
  },
} as const;

export function Pasos({ de }: { de: keyof typeof RECORRIDOS }) {
  const r = RECORRIDOS[de] ?? RECORRIDOS.venta;
  return (
    <AlVerse className="ilus-pasos" etiqueta={r.etiqueta}>
      <ol className="pas-lista">
        {r.pasos.map(({ Icono, t, d }, i) => (
          <li key={t} style={{ "--i": i } as CSSProperties}>
            <span className="pas-nodo">
              <Icono />
            </span>
            <b>{t}</b>
            <span>{d}</span>
          </li>
        ))}
      </ol>
    </AlVerse>
  );
}
