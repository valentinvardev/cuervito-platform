"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, Hash, ReceiptText, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Fila = { id: string; nombre: string; meta: string };
type Resultado = {
  eventos: Fila[];
  ventas: Fila[];
  dorsal: { numero: string; fotos: number } | null;
  /** Con la pill de dorsal: en qué eventos aparece, el que más fotos tiene primero. */
  dorsalEventos: Fila[];
};

const VACIO: Resultado = { eventos: [], ventas: [], dorsal: null, dorsalEventos: [] };

/** Qué es cada renglón; panel.css le da un color a cada uno. */
type Tipo = "dorsal" | "evento" | "venta";

/**
 * Los tipos de búsqueda, en el orden de la ayuda. Elegir uno pone su pill en
 * el campo y la búsqueda se limita a eso.
 */
const TIPOS: Record<
  Tipo,
  {
    Icono: typeof Hash;
    /** El renglón de la ayuda. */
    titulo: string;
    ayuda: string;
    /** Lo que dice la pill. */
    pill: string;
    placeholder: string;
    /** Cuántos caracteres hacen falta para buscar. */
    minimo: number;
    /** El panel con la pill puesta y el campo todavía vacío. */
    falta: [string, string];
    /** Sin resultados. */
    nada: string;
    /** Qué se está buscando, mientras llega y arriba de lo que llegó. */
    buscando: (q: string) => string;
    resultados: (q: string) => string;
  }
> = {
  dorsal: {
    Icono: Hash,
    titulo: "Un dorsal",
    ayuda: "Escribí el número y listo",
    pill: "Dorsal",
    placeholder: "Número de dorsal",
    // Hay dorsales de una cifra.
    minimo: 1,
    falta: ["Escribí el número", "Te decimos en qué eventos aparece y cuántas fotos tiene."],
    nada: "Puede que el dorsal no se haya leído bien, o que esas fotos todavía estén procesando.",
    buscando: (q) => `Buscando el dorsal ${q}`,
    resultados: (q) => `Eventos con el dorsal ${q}`,
  },
  evento: {
    Icono: CalendarDays,
    titulo: "Un evento",
    ayuda: "Por nombre o por lugar",
    pill: "Evento",
    placeholder: "Nombre o lugar del evento",
    minimo: 2,
    falta: ["Escribí el nombre o el lugar", "Buscamos entre todos tus eventos."],
    nada: "Probá con otra parte del nombre, o con el lugar.",
    buscando: (q) => `Buscando eventos con “${q}”`,
    resultados: (q) => `Eventos con “${q}”`,
  },
  venta: {
    Icono: ReceiptText,
    titulo: "Una venta",
    ayuda: "Por comprador o por mail",
    pill: "Venta",
    placeholder: "Comprador o mail",
    minimo: 2,
    falta: ["Escribí el nombre o el mail", "Del comprador, para encontrar su venta."],
    nada: "Probá con el mail, o con otra parte del nombre.",
    buscando: (q) => `Buscando ventas de “${q}”`,
    resultados: (q) => `Ventas de “${q}”`,
  },
};
const ORDEN: Tipo[] = ["dorsal", "evento", "venta"];

type Item = {
  tipo: Tipo;
  icono: React.ReactNode;
  nombre: React.ReactNode;
  meta: string;
  /** A dónde lleva, o qué hace: los renglones de la ayuda eligen un tipo. */
  ir: { href: string } | { tipo: Tipo };
};

export function Buscador({ placeholder }: { placeholder: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [res, setRes] = useState<Resultado>(VACIO);
  // Desde la tecla hasta que llega la respuesta de ESA consulta. Sin esto el
  // panel no decía nada en ese rato: mostraba lo de la consulta anterior, o
  // "Nada con…" antes de haber buscado.
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [marcado, setMarcado] = useState(0);
  const caja = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLInputElement>(null);

  const minimo = tipo ? TIPOS[tipo].minimo : 2;
  const corto = q.trim().length < minimo;

  // Cada tecla cancela el pedido anterior. Sin esto, escribiendo rápido llegan
  // respuestas fuera de orden y la lista termina mostrando los resultados de
  // una consulta vieja: el clásico bug de que borrás una letra y aparecen más
  // resultados que antes. Cambiar la pill cuenta como una tecla más.
  useEffect(() => {
    if (q.trim().length < minimo) {
      setRes(VACIO);
      setCargando(false);
      return;
    }
    setCargando(true);
    const corte = new AbortController();
    const id = setTimeout(() => {
      const params = new URLSearchParams({ q });
      if (tipo) params.set("tipo", tipo);
      fetch(`/api/v2/buscar?${params.toString()}`, { signal: corte.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: Partial<Resultado>) => {
          /* Sólo se guarda lo que tiene la forma que se espera.

             Antes se guardaba lo que viniera. El endpoint contestó `{error}`
             —un 403 que nadie había visto porque no nos pasaba a nosotros—,
             eso quedó en `res`, y en el render siguiente `res.eventos.forEach`
             reventó. Sin un límite de error en el panel, esa línea tiraba
             abajo la pantalla ENTERA: el fotógrafo escribía dos letras en la
             barra y se quedaba mirando un fondo vacío.

             Una respuesta rara es "sin resultados". Nunca es "sin panel". */
          setCargando(false);
          if (!Array.isArray(d.eventos) || !Array.isArray(d.ventas)) {
            setRes(VACIO);
            return;
          }
          setRes({
            eventos: d.eventos,
            ventas: d.ventas,
            dorsal: d.dorsal ?? null,
            dorsalEventos: Array.isArray(d.dorsalEventos) ? d.dorsalEventos : [],
          });
          setMarcado(0);
        })
        .catch((e: unknown) => {
          // Cancelado por la tecla siguiente: no hay nada que mostrar todavía,
          // y la consulta nueva sigue cargando. Cualquier otra falla se
          // muestra como lista vacía, por lo de arriba.
          if ((e as Error).name === "AbortError") return;
          setCargando(false);
          setRes(VACIO);
        });
    }, 180);
    return () => {
      clearTimeout(id);
      corte.abort();
    };
  }, [q, tipo, minimo]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      /* Por el recorrido del evento y no por contains(e.target). Elegir un
         renglón de la ayuda o sacar la pill re-dibuja el panel ANTES de que
         este listener corra, y el renglón tocado ya no está en el documento:
         contains decía "afuera" y el panel se cerraba justo al elegir. El
         recorrido se arma al hacer el clic, así que todavía lo incluye. */
      const c = caja.current;
      if (c && !e.composedPath().includes(c)) setAbierto(false);
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

  /** Pone la pill. Lo escrito se conserva: "123" y después "Dorsal" sigue buscando el 123. */
  function elegirTipo(t: Tipo) {
    setTipo(t);
    if (t === "dorsal") setQ((v) => v.replace(/[^0-9]/g, ""));
    setRes(VACIO);
    setMarcado(0);
    setAbierto(true);
    campo.current?.focus();
  }

  function quitarTipo() {
    setTipo(null);
    setRes(VACIO);
    setMarcado(0);
    campo.current?.focus();
  }

  // Sin pill y sin nada escrito, el panel es la ayuda, y sus renglones se
  // eligen con el mouse o con las flechas igual que un resultado.
  const guia = !tipo && corto;
  const items: Item[] = [];
  if (guia) {
    for (const t of ORDEN) {
      const { Icono, titulo, ayuda } = TIPOS[t];
      items.push({ tipo: t, icono: <Icono />, nombre: titulo, meta: ayuda, ir: { tipo: t } });
    }
  } else if (tipo === "dorsal") {
    // El evento llega con las fotos de ese dorsal ya filtradas.
    res.dorsalEventos.forEach((e) =>
      items.push({
        tipo: "dorsal",
        icono: <Hash />,
        nombre: e.nombre,
        meta: e.meta,
        ir: { href: `/dashboard/evento/${e.id}?dorsal=${encodeURIComponent(q.trim())}` },
      }),
    );
  } else {
    if (res.dorsal) {
      // La cuenta sola no lleva a ningún lado útil: elegirlo pone la pill de
      // dorsal, que muestra en qué eventos está.
      items.push({
        tipo: "dorsal",
        icono: <Hash />,
        nombre: `Dorsal ${res.dorsal.numero}`,
        meta:
          res.dorsal.fotos > 0
            ? `${res.dorsal.fotos.toLocaleString("es-AR")} fotos con ese número · ver en qué eventos`
            : "Ninguna foto con ese número",
        ir: { tipo: "dorsal" },
      });
    }
    res.eventos.forEach((e) =>
      items.push({ tipo: "evento", icono: <CalendarDays />, nombre: e.nombre, meta: e.meta, ir: { href: `/dashboard/evento/${e.id}` } }),
    );
    // A ESA venta, abierta. Antes llevaba a la lista general, que muestra las
    // últimas cincuenta: buscar una venta de hace dos meses te dejaba en una
    // lista donde no estaba.
    res.ventas.forEach((v) =>
      items.push({ tipo: "venta", icono: <ReceiptText />, nombre: v.nombre, meta: v.meta, ir: { href: `/dashboard/ventas?venta=${v.id}` } }),
    );
  }
  // El marcado puede venir de una lista más larga que la de ahora.
  const elegido = Math.min(marcado, Math.max(items.length - 1, 0));

  function ir(i: number) {
    const it = items[i];
    if (!it) return;
    if ("tipo" in it.ir) {
      elegirTipo(it.ir.tipo);
      return;
    }
    setAbierto(false);
    router.push(it.ir.href);
  }

  const Pill = tipo ? TIPOS[tipo].Icono : null;

  return (
    <div className="search" ref={caja} data-abierto={abierto ? "1" : ""}>
      {/* Un clic en cualquier parte de la caja va al campo, también al lado de
          la pill. Con un <label> no: el botón de quitar la pill es lo primero
          que se puede activar adentro, y el label se lo daría a él. */}
      <div
        className="search-f"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            campo.current?.focus();
          }
        }}
      >
        {/* Mientras busca, la lupa gira: es lo primero que se mira al tipear. */}
        {cargando ? <span className="spin lupa-gira" aria-hidden="true" /> : <Search className="lupa" />}
        {tipo && Pill && (
          <span className="sr-pill" data-tipo={tipo}>
            <Pill />
            {TIPOS[tipo].pill}
            <button
              type="button"
              aria-label={`Dejar de buscar sólo por ${TIPOS[tipo].pill.toLowerCase()}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={quitarTipo}
            >
              <X />
            </button>
          </span>
        )}
        <input
          ref={campo}
          type="search"
          value={q}
          placeholder={tipo ? TIPOS[tipo].placeholder : placeholder}
          inputMode={tipo === "dorsal" ? "numeric" : undefined}
          autoComplete="off"
          onChange={(e) => setQ(tipo === "dorsal" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value)}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (!items.length) return;
              setMarcado(
                e.key === "ArrowDown" ? (elegido + 1) % items.length : (elegido - 1 + items.length) % items.length,
              );
            } else if (e.key === "Enter") {
              e.preventDefault();
              ir(elegido);
            } else if (e.key === "Backspace" && q === "" && tipo) {
              // Como en cualquier campo con etiquetas: borrar con el campo
              // vacío se lleva la pill.
              e.preventDefault();
              quitarTipo();
            } else if (e.key === "Escape") {
              if (q) setQ("");
              else if (tipo) quitarTipo();
              else {
                setAbierto(false);
                campo.current?.blur();
              }
            }
          }}
        />
      </div>
      <kbd>Ctrl K</kbd>

      <div className="sr" role="listbox" aria-busy={cargando} data-cargando={cargando ? "1" : undefined}>
        {guia && <div className="sr-tit">Buscá por</div>}
        {/* Qué se está buscando, con las mismas palabras mientras carga y
            cuando llega. Lo de la consulta anterior se queda abajo, apagado:
            vaciar la lista en cada tecla la haría parpadear. */}
        {!guia && !corto && (cargando || items.length > 0) && (
          <div className="sr-tit sr-estado" aria-live="polite">
            {cargando && <span className="spin" aria-hidden="true" />}
            <span>
              {cargando
                ? `${tipo ? TIPOS[tipo].buscando(q.trim()) : `Buscando “${q.trim()}”`}…`
                : tipo
                  ? TIPOS[tipo].resultados(q.trim())
                  : `Resultados para “${q.trim()}”`}
            </span>
          </div>
        )}
        {tipo && corto ? (
          <div className="sr-nada">
            <b>{TIPOS[tipo].falta[0]}</b>
            <span>{TIPOS[tipo].falta[1]}</span>
          </div>
        ) : items.length > 0 ? (
          items.map((it, i) => (
            <div
              key={`${"href" in it.ir ? it.ir.href : it.ir.tipo}-${i}`}
              role="option"
              aria-selected={i === elegido}
              className={`sr-item${i === elegido ? " marcado" : ""}`}
              onMouseEnter={() => setMarcado(i)}
              // Sin esto, el clic le saca el foco al campo antes de llegar.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => ir(i)}
            >
              <span className="sr-i" data-tipo={it.tipo}>
                {it.icono}
              </span>
              <span className="sr-t">
                <b>{it.nombre}</b>
                <span>{it.meta}</span>
              </span>
              <span className="sr-tec">Enter</span>
            </div>
          ))
        ) : cargando ? null : (
          <div className="sr-nada">
            <b>Nada con “{q}”</b>
            <span>{tipo ? TIPOS[tipo].nada : "Probá con el nombre del evento, un dorsal o el comprador."}</span>
          </div>
        )}
      </div>
    </div>
  );
}
