"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { EventoChat } from "~/server/chat-bus";

/**
 * Lo que un admin ve del chat desde CUALQUIER pantalla: un aviso abajo a la
 * derecha cuando escribe un fotógrafo, y el número del riel al día.
 *
 * Escucha el mismo SSE que la bandeja pero sin `presencia`: tener el panel
 * abierto en otra pestaña no es estar atendiendo el chat, y a los fotógrafos
 * no se les dice "en línea" por esto. En /admin/chat no muestra avisos: ahí
 * el mensaje ya se ve llegar.
 *
 * El número del riel no se toca acá: viene del servidor con cada pantalla, y
 * un router.refresh() lo trae de nuevo. Mismo criterio que ventas en vivo.
 */

type Aviso = { id: string; conversacionId: string; quien: string; detalle: string; yendo: boolean };

const DURACION_MS = 8000;
const SALIDA_MS = 260;
const MAXIMO = 3;

export function ChatAdminEnVivo() {
  const router = useRouter();
  const ruta = usePathname();
  const enBandeja = useRef(false);
  enBandeja.current = ruta.startsWith("/admin/chat");

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const relojes = useRef<ReturnType<typeof setTimeout>[]>([]);
  const refresco = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/admin/chat/stream");

    const refrescar = () => {
      if (refresco.current) clearTimeout(refresco.current);
      refresco.current = setTimeout(() => router.refresh(), 250);
    };

    es.addEventListener("chat", (e) => {
      let ev: EventoChat;
      try {
        ev = JSON.parse((e as MessageEvent<string>).data) as EventoChat;
      } catch {
        return;
      }
      if (ev.tipo === "leido" && ev.lado === "admin") {
        // Otro admin (u otra pestaña) leyó algo: el número del riel cambia.
        refrescar();
        return;
      }
      if (ev.tipo !== "mensaje" || ev.mensaje.deAdmin) return;
      refrescar();
      if (enBandeja.current) return;

      const m = ev.mensaje;
      const aviso: Aviso = {
        id: m.id,
        conversacionId: m.conversacionId,
        quien: m.usuario?.nombre ?? "Alguien",
        detalle: m.texto.split("\n")[0] ?? "",
        yendo: false,
      };
      setAvisos((prev) => (prev.some((a) => a.id === aviso.id) ? prev : [...prev, aviso].slice(-MAXIMO)));
      relojes.current.push(
        setTimeout(() => {
          setAvisos((prev) => prev.map((a) => (a.id === aviso.id ? { ...a, yendo: true } : a)));
          relojes.current.push(
            setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== aviso.id)), SALIDA_MS),
          );
        }, DURACION_MS),
      );
    });

    return () => {
      es.close();
      for (const r of relojes.current) clearTimeout(r);
      relojes.current = [];
      if (refresco.current) clearTimeout(refresco.current);
    };
  }, [router]);

  if (avisos.length === 0) return null;

  return (
    <div className="chat-avisos" aria-live="polite">
      {avisos.map((a) => (
        <Link
          key={a.id}
          href={`/admin/chat?c=${a.conversacionId}`}
          className="chat-aviso"
          data-yendo={a.yendo ? "1" : undefined}
          prefetch={false}
        >
          <span className="chat-aviso-av">
            <MessageCircle />
          </span>
          <span className="chat-aviso-t">
            <b>{a.quien} te escribió</b>
            <span>{a.detalle}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
