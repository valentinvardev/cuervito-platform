"use client";

import { useState } from "react";

import { useCart } from "./cart-context";
import { VisorFoto, type FotoVisor } from "./visor-foto";

/**
 * El visor de las plantillas feed y cobertura: el mismo VisorFoto que usa
 * encontrate, con el carrito conectado acá, que es donde estas dos lo tienen.
 *
 * Muestra la de 2400 (fullUrl). Antes mostraba previewUrl, que es la
 * miniatura de 560 de la grilla, y el CSS la dejaba a su tamaño: en un iPad
 * o una PC la foto quedaba chica y no llegaba al borde.
 */
type Photo = FotoVisor & { previewUrl: string };

export function PublicLightbox({
  photos,
  startIndex,
  pricePerPhoto,
  evento,
  regalo = false,
  barrido = false,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  pricePerPhoto: number;
  /** El nombre del evento, para la banda de arriba. */
  evento: string;
  regalo?: boolean;
  barrido?: boolean;
  onClose: () => void;
}) {
  const { isInCart, add, remove } = useCart();
  const [idx, setIdx] = useState(startIndex);
  const precio = regalo ? "Gratis" : `$${pricePerPhoto.toLocaleString("es-AR")}`;

  return (
    <VisorFoto
      fotos={photos}
      indice={idx}
      evento={evento}
      precio={precio}
      enCarrito={isInCart}
      alAlternar={(f) => {
        if (isInCart(f.id)) remove(f.id);
        else
          add({
            photoId: f.id,
            previewUrl: f.previewUrl ?? f.fullUrl,
            priceCents: Math.round(pricePerPhoto * 100),
          });
      }}
      alIr={setIdx}
      alCerrar={onClose}
      barrido={barrido}
    />
  );
}
