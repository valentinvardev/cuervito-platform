"use client";

import { useState } from "react";

import { AddCollaboratorModal } from "./collaborators-panel";

/**
 * Botón de invitar reutilizable. Abre el mismo modal que el panel de
 * colaboradores en Info, así el flujo es idéntico desde donde se dispare
 * (portada del evento y zona de subida de fotos).
 */
export function InviteCollaboratorButton({
  eventId,
  pricePerPhoto,
  variant = "default",
  label = "Invitar colaborador",
}: {
  eventId: string;
  pricePerPhoto: number;
  /** "cover" usa el estilo de los botones sobre la portada. */
  variant?: "default" | "cover";
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={variant === "cover" ? "cover-btn" : "btn btn-outline"}
        onClick={() => setOpen(true)}
        data-tip="Invitar a otro fotógrafo a subir fotos en este evento"
      >
        <i className="ti ti-user-plus" />
        {label}
      </button>
      {open && (
        <AddCollaboratorModal
          eventId={eventId}
          pricePerPhoto={pricePerPhoto}
          onClose={() => setOpen(false)}
          onCreated={() => setOpen(false)}
        />
      )}
    </>
  );
}
