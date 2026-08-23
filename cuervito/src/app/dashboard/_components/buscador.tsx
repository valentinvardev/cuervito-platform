"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Hash, ReceiptText, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Fila = { id: string; nombre: string; meta: string };
type Resultado = { eventos: Fila[]; ventas: Fila[]; dorsal: { numero: string; fotos: number } | null };

const VACIO: Resultado = { eventos: [], ventas: [], dorsal: null };

export function Buscador({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Resultado>(VACIO);
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  // Cada tecla cancela el pedido anterior. Sin esto, escribiendo rápido llegan
  // respuestas fuera de orden y la lista termina mostrando los resultados de
  // una consulta vieja: el clásico bug de que borrás una letra y aparecen más
  // resultados que antes.
  useEffect(() => {
    if (q.trim().length < 2) {
      setRes(VACIO);
      return;
    }
    const corte = new AbortController();
    const id = setTimeout(() => {
      fetch(`/api/v2/buscar?q=${encodeURIComponent(q)}`, { signal: corte.signal })
        .then((r) => r.json())
        .then((d: Resultado) => {
          setRes(d);
          setMarcado(0);
        })
        .catch(() => {
          /* cancelado por la tecla siguiente */
        });
    }, 180);
    return () => {
      clearTimeout(id);
      corte.abort();
    };
  }, [q]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("click", fuera);
    return () => document.removeEventListener("click", fuera);
  }, []);

  // Ctrl/Cmd+K desde cualquier lado, salvo si ya estás escribiendo en otro
  // campo: robarle el atajo a alguien que está tipeando es peor que no tenerlo.
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        const foco = document.activeElement;
        if (foco && /INPUT|TEXTAREA/.test(foco.tagName) && foco !== campo.current) return;
        e.preventDefault();
        campo.current?.focus();
        campo.current?.select();
        setAbierto(true);
      }
    }
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, []);

  const items: { href: string; icono: React.ReactNode; nombre: React.ReactNode; meta: string }[] = [];
  if (res.dorsal) {
    items.push({
      href: `/dashboard/eventos`,
      icono: <Hash />,
      nombre: `Dorsal ${res.dorsal.numero}`,
      meta:
        res.dorsal.fotos > 0
          ? `${res.dorsal.fotos.toLocaleString("es-AR")} fotos con ese número`
          : "Ninguna foto con ese número",
    });
  }
  res.eventos.forEach((e) => items.push({ href: `/dashboard/events/${e.id}`, icono: <CalendarDays />, nombre: e.nombre, meta: e.meta }));
  res.ventas.forEach((v) => items.push({ href: `/dashboard/ventas`, icono: <ReceiptText />, nombre: v.nombre, meta: v.meta }));

  function ir(i: number) {
    const it = items[i];
    if (!it) return;
    setAbierto(false);
    router.push(it.href);
  }

  return (
    <div className="search" ref={caja} data-abierto={abierto ? "1" : ""}>
      <Search className="lupa" />
      <input
        ref={campo}
        type="search"
        value={q}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setAbierto(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!items.length) return;
            setMarcado((m) => (e.key === "ArrowDown" ? (m + 1) % items.length : (m - 1 + items.length) % items.length));
          } else if (e.key === "Enter") {
            e.preventDefault();
            ir(marcado);
          } else if (e.key === "Escape") {
            if (q) setQ("");
            else {
              setAbierto(false);
              campo.current?.blur();
            }
          }
        }}
      />
      <kbd>Ctrl K</kbd>

      <div className="sr" role="listbox">
        {q.trim().length < 2 ? (
          <>
            <div className="sr-tit">Buscá por</div>
            <div className="sr-item">
              <span className="sr-i">
                <Hash />
              </span>
              <span className="sr-t">
                <b>Un dorsal</b>
                <span>Escribí el número y listo</span>
              </span>
            </div>
            <div className="sr-item">
              <span className="sr-i">
                <CalendarDays />
              </span>
              <span className="sr-t">
                <b>Un evento</b>
                <span>Por nombre o por lugar</span>
              </span>
            </div>
            <div className="sr-item">
              <span className="sr-i">
                <ReceiptText />
              </span>
              <span className="sr-t">
                <b>Una venta</b>
                <span>Por comprador o por mail</span>
              </span>
            </div>
          </>
        ) : items.length > 0 ? (
          items.map((it, i) => (
            <div
              key={`${it.href}-${i}`}
              className={`sr-item${i === marcado ? " marcado" : ""}`}
              onMouseEnter={() => setMarcado(i)}
              onClick={() => ir(i)}
            >
              <span className="sr-i">{it.icono}</span>
              <span className="sr-t">
                <b>{it.nombre}</b>
                <span>{it.meta}</span>
              </span>
              <span className="sr-tec">Enter</span>
            </div>
          ))
        ) : (
          <div className="sr-nada">
            <b>Nada con “{q}”</b>
            <span>Probá con el nombre del evento, un dorsal o el comprador.</span>
          </div>
        )}
      </div>
    </div>
  );
}
