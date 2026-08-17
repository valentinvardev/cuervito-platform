"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Clock,
  Download,
  FileArchive,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { compartirLink, esIos, guardarConHojaDeCompartir } from "../guardar-ios";
import { Velo } from "./velo";

type Foto = { id: string; filename: string; bibNumbers: string | null; previewUrl: string };
type Fotografo = { nombre: string; slug: string; avatar: string | null; iniciales: string };

/**
 * La entrega: lo que ve el atleta después de pagar.
 *
 * Usa las mismas piezas que la página de venta porque es la misma persona diez
 * segundos más tarde. Y arriba lleva al fotógrafo con su foto y su nombre, con
 * el link de vuelta a su página: el atleta le compró a UNA persona, no a una
 * plataforma, y esa pantalla es la única prueba que le queda de a quién.
 *
 * En iOS, descargar no es descargar. Un <a download> deja el archivo en la app
 * Archivos, no en el carrete, y el atleta la busca en Fotos. Por eso ahí se
 * pasa por la hoja de compartir del sistema, que es la única vía que ofrece
 * "Guardar imagen".
 */
export function Entrega({
  token,
  comprador,
  evento,
  fotografo,
  fotos,
  vence,
  recienPagado,
}: {
  token: string;
  comprador: string;
  evento: string;
  fotografo: Fotografo;
  fotos: Foto[];
  vence: string | null;
  recienPagado: boolean;
}) {
  const [velo, setVelo] = useState(recienPagado);
  const [bajadas, setBajadas] = useState<Set<string>>(new Set());
  const [zipEnCurso, setZipEnCurso] = useState(false);
  const [ios, setIos] = useState(false);
  const [avisoCompartir, setAvisoCompartir] = useState<string | null>(null);
  const [manteneApretado, setManteneApretado] = useState(false);

  // En un efecto y no al renderizar: el servidor no tiene navigator, y decidirlo
  // durante el render dejaría el HTML del servidor distinto al del cliente.
  useEffect(() => setIos(esIos()), []);

  async function descargarUna(f: Foto) {
    // Mismo origen siempre: el fetch de Safari contra otro origen sin CORS tira
    // excepción y la descarga muere sin decir nada.
    const url = `/api/download/${token}/${f.id}/blob`;

    if (ios) {
      const r = await guardarConHojaDeCompartir(url, f.filename);
      if (r === "guardada") setBajadas((s) => new Set(s).add(f.id));
      else if (r === "mantener-apretado") setManteneApretado(true);
      return;
    }

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objeto = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objeto;
      a.download = f.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objeto);
      setBajadas((s) => new Set(s).add(f.id));
    } catch {
      window.open(`/api/download/${token}/${f.id}`, "_blank", "noopener");
    }
  }

  function descargarTodo() {
    setZipEnCurso(true);
    // El zip lo arma el servidor y puede tardar: se navega y el navegador se
    // encarga. Con fetch + blob habría que tener los 80 MB en memoria antes de
    // escribir el archivo.
    window.location.href = `/api/download/${token}/zip`;
    setTimeout(() => setZipEnCurso(false), 4000);
  }

  async function compartir() {
    const r = await compartirLink(window.location.href, `Mis fotos de ${evento}`);
    if (r === "copiado") setAvisoCompartir("Link copiado");
    else if (r === "error") setAvisoCompartir("No se pudo copiar");
    if (r !== "compartido") setTimeout(() => setAvisoCompartir(null), 2200);
  }

  return (
    <div className="et">
      {velo && <Velo alTerminar={() => setVelo(false)} />}

      {/* El fotógrafo arriba, con la vuelta a su página. El atleta le compró a
          una persona: si acá no está, la entrega se lee como de un sistema. */}
      <header className="et-top">
        <Link href={`/${fotografo.slug}`} className="et-marca">
          <span className="et-av">
            {fotografo.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={fotografo.avatar} alt="" />
            ) : (
              fotografo.iniciales
            )}
          </span>
          <span className="et-quien">
            <b>{fotografo.nombre}</b>
            <span>encontrate.app/{fotografo.slug}</span>
          </span>
        </Link>

        <Link href={`/${fotografo.slug}`} className="et-btn et-btn-sm eg-volver">
          <ArrowLeft /> Ver más fotos
        </Link>
      </header>

      <div className="et-in">
        <section className="eg-hero">
          <div className="eg-hero-i">
            <CircleCheck />
          </div>
          <h1>Listo, {comprador.split(" ")[0]}. Son tuyas.</h1>
          <p>
            {fotos.length === 1 ? "Tu foto" : `Tus ${fotos.length} fotos`} de <b>{evento}</b>, sin
            marca de agua y en calidad original. También te las mandamos por mail.
          </p>
        </section>

        <section className="eg-acciones">
          <div className="eg-acciones-t">
            <b>Descargar todo</b>
            <span>
              Un .zip con {fotos.length === 1 ? "la foto" : `las ${fotos.length} fotos`}
            </span>
          </div>
          <button className="et-btn" onClick={compartir}>
            <Share2 /> {avisoCompartir ?? "Compartir link"}
          </button>
          <button className="et-btn et-btn-lleno" onClick={descargarTodo} disabled={zipEnCurso}>
            <FileArchive /> {zipEnCurso ? "Preparando…" : "Descargar todo"}
          </button>
        </section>

        {/* En iOS el .zip cae en Archivos y no en Fotos. Decirlo antes evita el
            "lo descargué y no lo encuentro". */}
        {ios && (
          <div className="eg-vence">
            <Download />
            <span>
              En iPhone, el <b>.zip</b> se guarda en la app Archivos. Para que queden en tu carrete,
              descargalas de a una desde abajo.
            </span>
          </div>
        )}

        {manteneApretado && (
          <div className="eg-vence">
            <Download />
            <span>
              Tu iPhone no permite guardar desde el botón. <b>Mantené apretada</b> la foto y elegí
              &ldquo;Guardar en Fotos&rdquo;.
            </span>
          </div>
        )}

        {vence && (
          <div className="eg-vence">
            <Clock />
            <span>
              Este link funciona hasta el <b>{vence}</b>. Después escribinos y te damos uno nuevo.
            </span>
          </div>
        )}

        <section className="et-grilla">
          {fotos.map((f) => {
            const lista = bajadas.has(f.id);
            return (
              <div className="et-foto" key={f.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.previewUrl} alt="" loading="lazy" />
                {f.bibNumbers && (
                  <span className="et-foto-dorsal">#{f.bibNumbers.split(",")[0]}</span>
                )}
                <button
                  className="eg-baja"
                  data-listo={lista ? "1" : ""}
                  onClick={() => void descargarUna(f)}
                  aria-label={`Descargar ${f.filename}`}
                >
                  {lista ? <Check /> : <Download />}
                  <span>{lista ? "Descargada" : "Descargar"}</span>
                </button>
              </div>
            );
          })}
        </section>
      </div>

      <footer className="et-pie">
        <span>Guardá este link: podés volver a descargarlas mientras esté vigente.</span>
        <a href="https://encontrate.app" target="_blank" rel="noopener">
          Hecho con encontrate.app
        </a>
      </footer>
    </div>
  );
}
