import Link from "next/link";
import { AtSign, CalendarDays, Globe, ImageOff, MapPin } from "lucide-react";

/**
 * El perfil público del fotógrafo, en la plantilla de encontrate.
 *
 * Es la página de ANTES del evento: quién es y qué cubrió. La barra, el hero y
 * el pie son los mismos de la página de evento —es la misma tienda un nivel más
 * arriba, y si acá se viera distinta el que entra dudaría de si sigue en el
 * mismo lugar—, así que lo propio de esta página es sólo la lista de eventos.
 *
 * Es un componente de servidor: no hay nada acá que necesite al navegador. La
 * página de evento sí lo necesita, por el carrito y el visor; ésta es una lista
 * de links y no tiene por qué costar JavaScript.
 */

type Evento = {
  id: string;
  slug: string | null;
  nombre: string;
  portada: string | null;
  fecha: string | null;
  lugar: string | null;
  fotos: number;
  precio: string;
};

export function PerfilEncontrate({
  fotografo,
  eventos,
}: {
  fotografo: {
    slug: string;
    nombre: string;
    bio: string | null;
    lugar: string | null;
    /** El usuario de Instagram, sin arroba. */
    instagram: string | null;
    web: string | null;
    iniciales: string;
    avatarUrl: string | null;
    logoUrl: string | null;
  };
  eventos: Evento[];
}) {
  const totalFotos = eventos.reduce((a, e) => a + e.fotos, 0);

  return (
    <div className="et">
      <header className="et-top">
        {/* Si subió su logo, va SOLO el logo. El avatar con el nombre y la
            dirección es un logo provisional —lo que ponemos mientras no tiene
            el suyo— y mostrar los dos juntos son dos marcas de la misma
            persona compitiendo. Igual que en la página de evento. */}
        <Link href={`/${fotografo.slug}`} className="et-marca">
          {fotografo.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="et-logo" src={fotografo.logoUrl} alt={fotografo.nombre} />
          ) : (
            <>
              <span className="et-av">
                {fotografo.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={fotografo.avatarUrl} alt="" />
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
      </header>

      <div className="et-in">
        <section className="et-hero">
          {fotografo.lugar && (
            <div className="et-hero-meta">
              <MapPin style={{ width: 14, height: 14 }} />
              <span>{fotografo.lugar}</span>
            </div>
          )}

          <h1>{fotografo.nombre}</h1>

          {fotografo.bio && <p className="et-perfil-bio">{fotografo.bio}</p>}

          {eventos.length > 0 && (
            <div className="et-hero-pie">
              <b>{eventos.length.toLocaleString("es-AR")}</b>
              <span>{eventos.length === 1 ? "evento" : "eventos"}</span>
              <i />
              <b>{totalFotos.toLocaleString("es-AR")}</b>
              <span>fotos</span>
            </div>
          )}

          {(fotografo.instagram ?? fotografo.web) && (
            <div className="et-perfil-links">
              {fotografo.instagram && (
                <a
                  className="et-btn et-btn-sm"
                  href={`https://instagram.com/${fotografo.instagram}`}
                  target="_blank"
                  rel="noopener"
                >
                  <AtSign /> {fotografo.instagram}
                </a>
              )}
              {fotografo.web && (
                <a className="et-btn et-btn-sm" href={fotografo.web} target="_blank" rel="noopener">
                  <Globe /> Sitio web
                </a>
              )}
            </div>
          )}
        </section>

        {eventos.length > 0 ? (
          <section className="et-eventos">
            {eventos.map((e) => (
              <Link key={e.id} href={`/${fotografo.slug}/${e.slug}`} className="et-ev">
                <div className="et-ev-portada">
                  {e.portada ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.portada} alt="" loading="lazy" />
                  ) : (
                    <span className="et-ev-sin">
                      <ImageOff />
                      Sin portada
                    </span>
                  )}
                  {/* Sobre la portada: es el dato que dice si vale la pena
                      entrar, y arriba de la foto se lee sin bajar la vista. */}
                  {e.fotos > 0 && (
                    <span className="et-ev-fotos">
                      {e.fotos.toLocaleString("es-AR")} {e.fotos === 1 ? "foto" : "fotos"}
                    </span>
                  )}
                </div>

                <div className="et-ev-cuerpo">
                  <b>{e.nombre}</b>
                  <div className="et-ev-meta">
                    {e.fecha && <span>{e.fecha}</span>}
                    {e.fecha && e.lugar && <i />}
                    {e.lugar && <span>{e.lugar}</span>}
                  </div>
                  <div className="et-ev-precio">
                    Fotos desde <b>{e.precio}</b>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <div className="et-vacio">
            <div className="et-vacio-i">
              <CalendarDays />
            </div>
            <h3>Todavía no hay eventos publicados</h3>
            <p>
              Cuando {fotografo.nombre.split(" ")[0]} publique su primera cobertura, sus fotos van a
              aparecer acá.
            </p>
          </div>
        )}
      </div>

      <footer className="et-pie">
        <span>Fotos de {fotografo.nombre}. Las comprás y te las llevás sin marca de agua.</span>
        <a href="https://encontrate.app" target="_blank" rel="noopener">
          Hecho con encontrate.app
        </a>
      </footer>
    </div>
  );
}
