"use client";

import { CircleAlert, Package, Percent, Tag, Ticket, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

type Descuento = {
  id: string;
  type: "CODE" | "BUNDLE" | "QTYPCT";
  code: string | null;
  kind: string | null;
  value: number | null;
  qty: number | null;
  price: number | null;
  expires: string | null;
  maxUses: number | null;
  usageCount: number;
};

type Tipo = "QTYPCT" | "BUNDLE" | "CODE";

function pesos(n: number) {
  return "$" + Math.round(n).toLocaleString("es-AR");
}

/**
 * Los descuentos del evento.
 *
 * Tres formas, y la diferencia entre ellas es QUIÉN los activa:
 *
 * · Por cantidad (%) y por paquete se aplican SOLOS cuando el atleta llega a la
 *   cantidad. No hay nada que escribir ni que recordar, y por eso son los que
 *   la página de venta anuncia arriba de la grilla.
 *
 * · El código lo tiene que escribir alguien que lo recibió. NO se publica en la
 *   tienda a propósito: un código puesto en la misma página donde se compra es
 *   un descuento con un paso de más para todos. Sirve para repartirlo aparte —
 *   al club, a los que corrieron el año pasado— y ahí sí vale lo que cuesta.
 *
 * Todo esto ya lo aplicaba el checkout; lo que faltaba era poder crearlos sin
 * ir al panel viejo.
 */
export function Descuentos({ eventId, precio }: { eventId: string; precio: number }) {
  const [lista, setLista] = useState<Descuento[] | null>(null);
  const [tipo, setTipo] = useState<Tipo>("QTYPCT");
  const [qty, setQty] = useState(5);
  const [pct, setPct] = useState(15);
  const [precioPaq, setPrecioPaq] = useState(Math.round(precio * 0.8));
  const [codigo, setCodigo] = useState("");
  const [codKind, setCodKind] = useState<"pct" | "fixed">("pct");
  const [codValor, setCodValor] = useState(20);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const r = await fetch(`/api/dashboard/events/${eventId}/discounts`);
      if (!r.ok) throw new Error();
      setLista((await r.json()) as Descuento[]);
    } catch {
      setLista([]);
    }
  }

  useEffect(() => {
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  async function crear() {
    setGuardando(true);
    setError(null);
    const cuerpo =
      tipo === "CODE"
        ? { type: "CODE", code: codigo.trim().toUpperCase(), kind: codKind, value: codValor }
        : tipo === "BUNDLE"
          ? { type: "BUNDLE", qty, price: precioPaq }
          : { type: "QTYPCT", qty, value: pct };

    try {
      const r = await fetch(`/api/dashboard/events/${eventId}/discounts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!r.ok) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "No se pudo crear.");
        return;
      }
      setCodigo("");
      await cargar();
    } catch {
      setError("No se pudo crear. Probá de nuevo.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id: string) {
    // Optimista: la fila se va al instante y vuelve si el servidor rechaza.
    // Borrar un descuento es reversible —se vuelve a crear— así que no hace
    // falta un diálogo de confirmación en el medio.
    const antes = lista;
    setLista((l) => l?.filter((d) => d.id !== id) ?? null);
    const r = await fetch(`/api/dashboard/events/${eventId}/discounts/${id}`, {
      method: "DELETE",
    });
    if (!r.ok) {
      setLista(antes);
      setError("No se pudo borrar.");
    }
  }

  const valido =
    tipo === "CODE"
      ? codigo.trim().length >= 2 && codValor > 0
      : tipo === "BUNDLE"
        ? qty >= 2 && precioPaq > 0 && precioPaq < precio
        : qty >= 2 && pct >= 1 && pct <= 99;

  return (
    <div className="card blq">
      <h2>Descuentos</h2>
      <p className="ayuda">
        Para que el atleta se lleve más de una foto. Los de cantidad se aplican solos; el código hay
        que repartirlo.
      </p>

      <div className="blq-b">
        {lista === null ? (
          <div className="dsc-fila">
            <span className="sk" style={{ width: "100%", height: 44, borderRadius: 10 }} />
          </div>
        ) : lista.length === 0 ? (
          <div className="dsc-vacio">Todavía no hay descuentos en este evento.</div>
        ) : (
          <div className="dsc-lista">
            {lista.map((d) => (
              <div className="dsc-fila" key={d.id}>
                <span className="dsc-i">
                  {d.type === "CODE" ? <Ticket /> : d.type === "BUNDLE" ? <Package /> : <Percent />}
                </span>
                <span className="dsc-t">
                  <b>
                    {d.type === "CODE"
                      ? d.code
                      : d.type === "BUNDLE"
                        ? `${d.qty} o más a ${pesos(d.price ?? 0)} c/u`
                        : `${d.qty} o más, ${d.value}% menos`}
                  </b>
                  <span>
                    {d.type === "CODE"
                      ? `${d.kind === "pct" ? `${d.value}%` : pesos(d.value ?? 0)} de descuento · usado ${d.usageCount} ${d.usageCount === 1 ? "vez" : "veces"}`
                      : "Se aplica solo al pagar"}
                  </span>
                </span>
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => void borrar(d.id)}
                  aria-label="Borrar el descuento"
                  data-tip="Borrarlo no toca las ventas ya hechas"
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Crear uno. El tipo primero, porque cambia qué campos hacen falta. */}
        <div className="dsc-nuevo">
          <div className="dsc-tipos">
            {(
              [
                ["QTYPCT", "Por cantidad", Percent],
                ["BUNDLE", "Precio por paquete", Package],
                ["CODE", "Código", Ticket],
              ] as const
            ).map(([t, txt, Ico]) => (
              <button
                type="button"
                key={t}
                className="dsc-tipo"
                aria-pressed={tipo === t}
                onClick={() => setTipo(t)}
              >
                <Ico /> {txt}
              </button>
            ))}
          </div>

          {tipo === "QTYPCT" && (
            <>
              <div className="par">
                <div className="campo">
                  <label htmlFor="d-qty">Desde cuántas fotos</label>
                  <input
                    className="inp tnum"
                    id="d-qty"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="d-pct">Descuento</label>
                  <div className="pegado">
                    <input
                      className="inp tnum"
                      id="d-pct"
                      inputMode="numeric"
                      value={pct}
                      onChange={(e) => setPct(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    />
                    <span className="fijo">%</span>
                  </div>
                </div>
              </div>
              <div className="cuenta-p">
                Llevando {qty}, el atleta paga{" "}
                <b>{pesos(qty * precio * (1 - pct / 100))}</b> en vez de {pesos(qty * precio)}.
              </div>
            </>
          )}

          {tipo === "BUNDLE" && (
            <>
              <div className="par">
                <div className="campo">
                  <label htmlFor="b-qty">Desde cuántas fotos</label>
                  <input
                    className="inp tnum"
                    id="b-qty"
                    inputMode="numeric"
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value.replace(/\D/g, "")) || 0)}
                  />
                </div>
                <div className="campo">
                  <label htmlFor="b-precio">Precio por foto</label>
                  <div className="pegado">
                    <span className="fijo">$</span>
                    <input
                      className="inp tnum"
                      id="b-precio"
                      inputMode="numeric"
                      value={precioPaq}
                      onChange={(e) =>
                        setPrecioPaq(Number(e.target.value.replace(/\D/g, "")) || 0)
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="cuenta-p">
                {precioPaq >= precio ? (
                  <>
                    Ese precio no es más barato que el normal ({pesos(precio)}), así que no sería un
                    descuento.
                  </>
                ) : (
                  <>
                    Llevando {qty}, el atleta paga <b>{pesos(qty * precioPaq)}</b> en vez de{" "}
                    {pesos(qty * precio)}.
                  </>
                )}
              </div>
            </>
          )}

          {tipo === "CODE" && (
            <>
              <div className="par">
                <div className="campo">
                  <label htmlFor="c-cod">Código</label>
                  <input
                    className="inp"
                    id="c-cod"
                    placeholder="VERANO25"
                    value={codigo}
                    onChange={(e) =>
                      setCodigo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                    }
                  />
                </div>
                <div className="campo">
                  <label htmlFor="c-val">Descuento</label>
                  <div className="pegado">
                    {codKind === "fixed" && <span className="fijo">$</span>}
                    <input
                      className="inp tnum"
                      id="c-val"
                      inputMode="numeric"
                      value={codValor}
                      onChange={(e) => setCodValor(Number(e.target.value.replace(/\D/g, "")) || 0)}
                    />
                    <button
                      type="button"
                      className="fijo dsc-kind"
                      onClick={() => setCodKind((k) => (k === "pct" ? "fixed" : "pct"))}
                      data-tip="Cambiar entre porcentaje y monto fijo"
                    >
                      {codKind === "pct" ? "%" : "$"}
                    </button>
                  </div>
                </div>
              </div>
              {/* Dicho acá, donde se crea: si el fotógrafo espera que aparezca
                  en su página, va a creer que se rompió. */}
              <div className="porque">
                <CircleAlert />
                <span>
                  El código <b>no se muestra</b> en tu página: se lo pasás vos a quien quieras. Un
                  código publicado donde se compra es un descuento con un paso de más para todos.
                </span>
              </div>
            </>
          )}

          <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
            <button
              className="btn btn-pri"
              type="button"
              onClick={() => void crear()}
              disabled={guardando || !valido}
            >
              <Tag /> {guardando ? "Creando" : "Crear descuento"}
            </button>
            {error && <span style={{ color: "var(--bad)", fontSize: 13 }}>{error}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
