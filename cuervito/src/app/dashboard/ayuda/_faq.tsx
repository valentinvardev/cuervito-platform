"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

const PREGUNTAS = [
  {
    q: "¿Qué pasa con mis eventos cuando cambien la marca a encontrate.app?",
    a: "Nada. Los eventos siguen igual, con las mismas fotos y los mismos precios. Los links viejos de cuervito.app redirigen solos a los nuevos, incluidos los links de cada evento que ya hayas repartido.",
  },
  {
    q: "¿Por qué algunas fotos no aparecen cuando el atleta se busca?",
    a: "Puede ser que todavía se estén procesando, que la cara esté muy de perfil o tapada, o que la foto haya quedado sin reconocer por un error de subida. Escribinos y las mandamos a procesar de nuevo.",
  },
  {
    q: "¿Cuánto tarda en procesarse un evento?",
    a: "Cerca de un minuto cada 200 fotos. Un evento de 2.000 fotos está listo para buscar en unos diez minutos. No hace falta que te quedes esperando: podés publicarlo antes y las fotos se van sumando a medida que se procesan.",
  },
  {
    q: "¿Puedo cambiar el precio con el evento ya publicado?",
    a: "Sí, cuando quieras. El precio nuevo rige para las compras que se hagan de ahí en adelante; las ventas ya hechas no se tocan.",
  },
  {
    q: "¿Qué pasa si un atleta pide que le borren una foto?",
    a: "Podés borrarla desde el evento y desaparece de la búsqueda al instante. Si ya la habían comprado, el que la compró conserva su descarga: la venta está hecha y el link sigue funcionando hasta que vence.",
  },
  {
    q: "¿Puedo usar mi propio dominio?",
    a: "Sí, sin costo extra. En Mi página, abajo de la dirección, tenés la opción de conectar un dominio propio. Nosotros te damos los datos y vos los cargás donde compraste el dominio.",
  },
];

/**
 * Una sola pregunta abierta por vez: con todas abiertas la lista se vuelve un
 * muro de texto y se pierde el índice, que es la mitad de para qué sirve.
 */
export function Faq() {
  const [abierta, setAbierta] = useState<number | null>(null);

  return (
    <div>
      {PREGUNTAS.map((p, i) => (
        <div className="qa" key={i} data-abierta={abierta === i ? "1" : ""}>
          <button
            className="qa-t"
            aria-expanded={abierta === i}
            onClick={() => setAbierta((a) => (a === i ? null : i))}
          >
            {p.q}
            <span className="mas-i">
              <Plus />
            </span>
          </button>
          <div className="qa-b">
            <div>
              <p>{p.a}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
