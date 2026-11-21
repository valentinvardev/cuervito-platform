"use client";

import { abrirChat } from "./chat/burbuja";

/** Abre el chat de soporte: ampliar una cuota se hace a mano desde el admin. */
export function PedirMas({ texto }: { texto: string }) {
  return (
    <button type="button" className="btn btn-ghost btn-sm uso-pedir" onClick={() => abrirChat()}>
      {texto}
    </button>
  );
}
