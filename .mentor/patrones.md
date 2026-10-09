# Patrones

Anotaciones entre tareas. Un patrón necesita al menos dos apariciones para
existir: una vez es un descuido, dos es una tendencia.

## La misma regla escrita en N lugares
- Primera vez: 2026-09-06 (registrado; las apariciones son anteriores)
- Ocurrencias: 5 (fórmula de descuentos, tipografía por layout, `status !== "PAID"`, candado ADMIN de la vista previa /v2 — 2026-09-08; slugs reservados — 2026-10-07)
- Qué pasa: una decisión —cómo se calcula un descuento, qué fuente usa el
  panel, quién puede bajar las fotos— queda expresada como una línea repetida
  en cada lugar que la necesita, en vez de como un módulo con nombre.
- Por qué importa: mientras la regla no cambia, funciona y no se nota. El costo
  aparece el día que cambia: hay que encontrar las N copias, y la que se olvida
  es un bug silencioso. Las tres veces el arreglo fue el mismo —`lib/descuentos.ts`,
  `tokens.css`, `lib/venta.ts`— y las tres veces se hizo DESPUÉS de que la regla
  cambiara, no antes.
- La cuarta fue la más cara: el candado `role !== "ADMIN"` de cuando el panel
  era vista previa estaba en cada página Y en /api/v2/buscar. Al abrir el panel
  se sacó de las páginas y quedó en el endpoint. Todo fotógrafo real que
  escribía en la barra tiraba el panel entero en blanco, durante semanas, y
  nadie del equipo lo vio porque el equipo es admin y pasaba el candado.
- Señal temprana: si al agregar una funcionalidad hay que editar la misma
  condición en más de dos archivos, esa condición era un módulo.
- 2026-09-14, evitado a tiempo: getMpTestMode era la única bandera de Setting y
  estaba escrita a mano; con los interruptores de correos e historias iban a
  ser cinco copias. Se generalizó ANTES de copiarla (leerBandera/escribirBandera).
  Primera vez que el patrón se ve venir en vez de encontrarse después.
- 2026-09-14, evitado otra vez: el arrastre del encuadre en historias necesita
  saber dónde va la foto dentro de la pieza, y el render también. En vez de
  repetir los márgenes en el cliente, `cajaFoto()` en `formatos.ts` los dice una
  vez y los usan los dos lados. Misma jugada con `marca-agua-config.ts`: la
  forma de la config, sin server-only, importada por el editor y el servidor.
- 2026-10-07, la quinta: `RESERVED` estaba copiado en `[slug]/page.tsx` y en
  `[slug]/[eventSlug]/page.tsx` (ya distintas: a una le faltaba sitemap.xml), y
  los tres lugares que ASIGNAN slugs —registro, onboarding, perfil— no lo
  conocían. Resultado: un fotógrafo podía quedar con "demo" o "eventos" y una
  tienda inalcanzable. Se creó `lib/slugs-reservados.ts` para la asignación;
  las dos copias de las páginas quedaron a propósito hasta revisar la base.
  Mismo día, después de revisarla: las páginas pasaron a la lista compartida.
- 2026-10-07, evitado dos veces más: la comisión, lo incluido y las preguntas
  vivían como constantes de la landing, y el blog y /llms.txt los iban a
  repetir. Se movieron a `lib/producto.ts` ANTES de la segunda copia, y el
  MDX usa `<Comision />` en vez de «10%». El pie, que ya estaba dos veces
  (landing, /eventos), pasó a `_pie.tsx` antes de la tercera (blog).
- 2026-10-08, heredado y cortado al portar: en photo-saas Halcyon tenía su
  propia copia de `fillWa` (las otras plantillas usaban `lib/editor/wa.ts`) y
  las tres leían el formulario con `String(fd.get(x) ?? "")`, que convierte un
  File en "[object File]". Al traerlas quedó una sola función de cada cosa
  (`whatsapp.ts`: `fillWaTemplate`, `campo`).
- 2026-10-08, evitado desde el diseño: el candado "sólo admins" de Portfolio
  es una función (`lib/portfolio-acceso.ts`) que leen el riel, las pantallas
  y las acciones. Es exactamente la cuarta ocurrencia (el candado de /v2),
  resuelta antes de copiarla.
- Estado: activo

## Trabajo en vuelo que nadie gobierna
- Primera vez: 2026-09-20 (registrado; la primera aparición fue anterior)
- Ocurrencias: 2 (el `void (async …)` del commit, que moría con el proceso;
  el `Promise.race` del tope, que abandona pero no corta)
- Qué pasa: se lanza trabajo pesado y después se deja de mirarlo. La primera
  vez se dejó de mirarlo porque no se esperaba; la segunda porque se cansó de
  esperar. En los dos casos el trabajo siguió existiendo, consumiendo memoria
  y permisos, sin que nadie lo cuente ni lo pueda parar.
- Por qué importa: el costo no aparece en la prueba, aparece bajo carga. Y no
  es lineal: el trabajo abandonado hace más lento al que queda, que entonces
  también se abandona. Las dos veces terminó en fotos cobrables e invisibles
  en un evento publicado, y las dos veces se descubrió por una queja.
- Señal temprana: si lanzás algo que tarda y no guardás la forma de
  cancelarlo, no lo lanzaste, lo soltaste. Un `Promise.race` con un timeout es
  la versión que más se disfraza de correcta.
- 2026-10-07, evitado desde el diseño: los mails de «ya se publicó» no los
  manda el botón de publicar sino el remitente en cada pasada, con reclamo
  en la base y liberación de reclamos colgados. Publicar sólo EMPUJA una
  pasada (`void`), y si el proceso muere, la siguiente retoma. Es la primera
  vez que el trabajo suelto tiene un reconciliador desde el día uno.
- Estado: mejorando

## Estado derivado que se calcula una vez y nunca se reconcilia
- Primera vez: 2026-09-08 (registrado; la primera aparición fue el relleno de miniaturas)
- Ocurrencias: 2 (thumbKey → hizo falta `rellenar-miniaturas.mjs`; previewGeneratedAt → 160 fotos cobrables invisibles en un evento publicado)
- Qué pasa: el trabajo que deriva algo de una foto —miniatura, marca de agua,
  OCR, caras— corre una sola vez, en memoria, disparado por el commit. Si el
  proceso se reinicia (cada deploy hace `pm2 restart`), lo que estaba en cola se
  pierde y nada vuelve a preguntarse "¿a qué foto le falta algo?".
- Por qué importa: la falla es silenciosa. La foto existe, tiene tamaño, el
  fotógrafo la ve en su panel; la tienda no la muestra y el atleta no la
  encuentra. Se descubre por casualidad o por queja, meses después.
- Señal temprana: si un campo se llena "después" de crear la fila, tiene que
  existir la consulta que lista las filas donde sigue vacío, y algo que la corra.
- 2026-10-08, evitado desde el diseño: `Photo.portfolioKey` (la versión de
  1600px) nació con su consulta de pendientes y una pasada periódica
  (`server/portfolio-fotos.ts`), además del empujón al agregar fotos. La
  clave es determinística (HMAC del id), así que dos pasadas a la vez escriben
  el mismo archivo y no dejan huérfanos.
- Estado: mejorando

## Estado de proceso en una variable de módulo
- Primera vez: 2026-10-08 (registrado; la primera aparición fue el semáforo de sharp)
- Ocurrencias: 2 (el `let active` del semáforo de sharp, que eran dos
  contadores; la caché de las marcas PNG en `watermark.ts`, 2026-10-08)
- Qué pasa: algo que tiene que ser uno solo por proceso —un contador, una
  caché con invalidación— se declara como `let` o `const new Map()` de módulo.
  En Next, instrumentation.ts (donde corre la cola) y las rutas son dos capas
  de webpack: el módulo se evalúa dos veces y hay dos copias.
- Por qué importa: no rompe nada visible. El semáforo dejaba pasar el doble de
  decodes; la caché hacía que la ruta que sube la marca invalidara SU copia y
  la cola siguiera un minuto con la vieja. Las fallas son de a ratos y no se
  reproducen en una prueba con una sola ruta.
- Señal temprana: si una variable de módulo se escribe desde una ruta y se lee
  desde la cola (o al revés), va en `globalThis.__cuervito_x__ ??=`. El repo ya
  tiene la convención; `marca-agua.ts` la usó desde el principio.
- Estado: activo
