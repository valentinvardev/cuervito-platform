"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Download,
  FileArchive,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { NOMBRE, SITIO } from "~/lib/marca";

import { compartirLink, esIos, guardarConHojaDeCompartir } from "../guardar-ios";
import { Velo } from "./velo";
import { Visor } from "./visor";

type Foto = { id: string; filename: string; bibNumbers: string | null; previewUrl: string };
type Fotografo = {
  nombre: string;
  slug: string;
  avatar: string | null;
  /** Su logo, si lo subió. Cuando está, reemplaza al avatar y al nombre. */
  logo: string | null;
  iniciales: string;
};

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
  recienPagado,
  simulado = false,
}: {
  token: string;
  comprador: string;
  evento: string;
  fotografo: Fotografo;
  fotos: Foto[];
  recienPagado: boolean;
  /**
   * Modo demo: finge las descargas en vez de pedirlas.
   *
   * Lo usa /demo, que muestra este mismo componente operándose solo para poder
   * grabarlo. Sin esto, la demo pediría archivos con un token que no existe y
   * la grabación mostraría errores; con esto se ve exactamente el mismo
   * recorrido, que es el punto del video.
   */
  simulado?: boolean;
}) {
  const [velo, setVelo] = useState(recienPagado);
  const [bajadas, setBajadas] = useState<Set<string>>(new Set());
  const [zipEnCurso, setZipEnCurso] = useState(false);
  const [ios, setIos] = useState(false);
  const [avisoCompartir, setAvisoCompartir] = useState<string | null>(null);
  const [manteneApretado, setManteneApretado] = useState(false);
  const [avisoZip, setAvisoZip] = useState(false);
  const [viendo, setViendo] = useState<number | null>(null);
  const [bajando, setBajando] = useState<Set<string>>(new Set());

  // En un efecto y no al renderizar: el servidor no tiene navigator, y decidirlo
  // durante el render dejaría el HTML del servidor distinto al del cliente.
  useEffect(() => setIos(esIos()), []);

  /**
   * Descargar una foto, con señal de que algo está pasando.
   *
   * El indicador importa sobre todo en iOS: ahí no se puede usar <a download>
   * —el archivo cae en la app Archivos y no en el carrete— así que primero hay
   * que bajar el original ENTERO y recién después abrir la hoja de compartir.
   * Con fotos de 15 o 20 MB por datos móviles son varios segundos en los que el
   * botón se veía igual que antes de tocarlo, y el comprador lo vuelve a tocar
   * creyendo que no pasó nada. En escritorio se nota menos porque el navegador
   * pone su propia barra de descarga, pero la señal no molesta.
   *
   * El try/finally no es adorno: hay tres salidas distintas —guardada, iPhone
   * viejo sin Web Share, y error— y el indicador tiene que apagarse en las
   * tres. Sobre todo en la rareza de iOS que hace que navigator.share tire
   * AbortError incluso cuando el usuario ya guardó la foto.
   */
  async function descargarUna(f: Foto) {
    if (bajando.has(f.id)) return;

    // Mismo origen siempre: el fetch de Safari contra otro origen sin CORS tira
    // excepción y la descarga muere sin decir nada.
    const url = `/api/download/${token}/${f.id}/blob`;

    // El indicador aparece recién a los 150 ms. Hay caminos que vuelven al
    // instante —un iPhone viejo sin Web Share ni siquiera intenta bajar nada, y
    // una foto ya cacheada resuelve en un cuadro— y ahí un anillo que aparece y
    // desaparece se lee como un parpadeo raro, no como "está trabajando".
    const reloj = setTimeout(() => {
      setBajando((s) => new Set(s).add(f.id));
    }, 150);

    try {
      await bajar(f, url);
    } finally {
      clearTimeout(reloj);
      setBajando((s) => {
        if (!s.has(f.id)) return s;
        const n = new Set(s);
        n.delete(f.id);
        return n;
      });
    }
  }

  async function bajar(f: Foto, url: string) {
    if (simulado) {
      await new Promise((r) => setTimeout(r, 1100));
      setBajadas((s) => new Set(s).add(f.id));
      return;
    }

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
    // El aviso del .zip se muestra ACÁ y no de entrada. Puesto siempre, es una
    // advertencia sobre algo que el comprador todavía no hizo y que quizás no
    // vaya a hacer; puesto al apretar, llega justo cuando le sirve.
    if (ios) setAvisoZip(true);
    setZipEnCurso(true);
    // En la demo no se navega a ningún lado: se queda mostrando "Preparando…"
    // el rato que dura la toma y vuelve solo.
    if (simulado) return;
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
          {/* Con logo propio va sólo el logo: el avatar con el nombre y la
              dirección es el logo provisional, el que ponemos mientras no tiene
              el suyo. */}
          {fotografo.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="et-logo" src={fotografo.logo} alt={fotografo.nombre} />
          ) : (
            <>
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
            </>
          )}
        </Link>

        <Link href={`/${fotografo.slug}`} className="et-btn eg-volver">
          <ArrowLeft /> Ver más
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

        {avisoZip && (
          <div className="eg-vence">
            <Download />
            <span>
              En iPhone el <b>.zip</b> se guarda en la app Archivos, no en tu carrete. Si las
              querés en Fotos, descargalas de a una desde abajo.
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

        <section className="et-grilla">
          {fotos.map((f, i) => {
            const lista = bajadas.has(f.id);
            const enCurso = bajando.has(f.id);
            return (
              <div
                className="et-foto"
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => setViendo(i)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setViendo(i);
                  }
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.previewUrl} alt="" loading="lazy" />
                {f.bibNumbers && (
                  <span className="et-foto-dorsal">#{f.bibNumbers.split(",")[0]}</span>
                )}
                <button
                  className="eg-baja"
                  data-listo={lista ? "1" : ""}
                  data-bajando={enCurso ? "1" : ""}
                  disabled={enCurso}
                  onClick={(e) => {
                    // Sin esto, descargar abre además la foto en grande.
                    e.stopPropagation();
                    void descargarUna(f);
                  }}
                  aria-label={`Descargar ${f.filename}`}
                >
                  {enCurso ? (
                    <i className="eg-giro" aria-hidden />
                  ) : lista ? (
                    <Check />
                  ) : (
                    <Download />
                  )}
                  <span>{enCurso ? "Bajando…" : lista ? "Descargada" : "Descargar"}</span>
                </button>
              </div>
            );
          })}
        </section>
      </div>

      {viendo !== null && (
        <Visor
          fotos={fotos}
          indice={viendo}
          descargadas={bajadas}
          alCerrar={() => setViendo(null)}
          alIr={setViendo}
          alDescargar={descargarUna}
        />
      )}

      <footer className="et-pie">
        <span>Guardá este link: podés volver a descargarlas mientras esté vigente.</span>
        {/* El texto dice la marca nueva, el link va al dominio que responde.
            Ésta es la página que ve TODO el que compra: el link roto de antes
            se lo comía cada comprador. */}
        <a href={SITIO} target="_blank" rel="noopener">
          Hecho con {NOMBRE}
        </a>
      </footer>
    </div>
  );
}
