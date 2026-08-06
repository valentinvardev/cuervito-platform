# Cuervito — Arquitectura

Marketplace de fotografía de eventos deportivos. El fotógrafo sube las fotos de
una carrera o partido, la plataforma las indexa por **cara** y por **número de
dorsal**, y cada participante encuentra las suyas y las compra sin necesidad de
crear una cuenta.

**Escala del código:** 216 archivos TS/TSX (~35.500 líneas) + 15 hojas de estilo
(~10.200 líneas). 38 páginas, 36 rutas de API, 30 modelos y enums en Prisma.

---

## 1. Stack

| Capa | Elección | Notas |
|---|---|---|
| Framework | **Next.js 15** (App Router) + React 19 | Server Components por defecto; `"use client"` solo donde hace falta interacción |
| Lenguaje | TypeScript estricto | `tsc --noEmit` es parte de `npm run check` |
| Base de datos | **PostgreSQL** en Supabase, vía **Prisma 6** | Se usa `prisma db push`, no migraciones versionadas |
| Auth | **NextAuth v5** (beta) con estrategia JWT + PrismaAdapter | Credenciales (bcrypt) y Google OAuth |
| Almacenamiento | **AWS S3** + **CloudFront** | CloudFront solo para entrega al comprador |
| Reconocimiento | **AWS Rekognition** | `DetectText` para dorsales, `IndexFaces`/`SearchFacesByImage` para caras |
| Pagos | **Mercado Pago** marketplace | Cada fotógrafo conecta su cuenta por OAuth; la plataforma retiene 10% |
| Email | **Resend** | Entrega de compra, notificación de venta, invitaciones |
| Imágenes | **sharp** | Watermark, previews, derivados |
| API interna | **tRPC 11** | Uso mínimo — la mayor parte son Route Handlers y Server Actions |
| Editor (admin) | **Konva** / react-konva | Herramienta interna de composición sobre canvas |

Deploy en **VPS con PM2** (no serverless). Esto importa: hay estado en memoria
que sobrevive entre requests, como el caché de colecciones de Rekognition y el
bus de ventas en tiempo real.

---

## 2. Modelo de dominio

```
User (PHOTOGRAPHER | ADMIN)
 ├── Event  (dueño = host)
 │    ├── Photo          ownerId = dueño · uploadedById = quien subió
 │    │    └── FaceRecord      (1 por cara indexada)
 │    ├── EventCollaborator    (invitación + parámetros de comisión)
 │    ├── Discount             (CODE | BUNDLE | QTYPCT)
 │    └── Sale
 │         ├── SaleItem        (photoId nullable → SetNull)
 │         ├── SaleCommission  (devengo por colaborador)
 │         └── DownloadLog
 ├── RecognitionUsage     (consumo mensual, para cuotas)
 └── CustomDomain         (dominio propio del storefront)
```

Tres decisiones que definen todo lo demás:

**El comprador no tiene cuenta.** `Sale.buyerEmail` es el identificador. El
acceso a las fotos compradas es un `downloadToken` con vencimiento, no una
sesión.

**El dueño del evento es el centro económico.** Aunque suba un colaborador,
`Photo.ownerId` apunta al dueño: él paga el storage y él cobra la venta.
`uploadedById` registra quién subió, solo para repartir comisiones.

**Las fotos se borran en dos tiempos.** `deletedAt` las saca del storefront de
inmediato, pero siguen disponibles para quien ya las compró. Un cron las elimina
de S3 recién pasado `PHOTO_RETENTION_DAYS`.

---

## 3. Mapa de rutas

**Público**
- `/` — landing
- `/[slug]` — storefront del fotógrafo
- `/[slug]/[eventSlug]` — galería del evento, búsqueda por dorsal y por selfie
- `/descarga/[token]` — descarga post-compra
- `/pago/{exito,error,pendiente,procesando}` — retorno de Mercado Pago
- `/invitacion/[token]` — aceptar invitación de colaborador

**Fotógrafo** (`/dashboard/*`)
`events`, `events/new`, `events/[id]`, `ventas`, `tienda`, `cobros`, `perfil`,
`ayuda`

**Admin** (`/admin/*`)
`users`, `sales`, `metricas`, `watermark`, `editor`, `settings`

**Middleware** (`src/middleware.ts`) hace dos cosas: resuelve dominios propios
(`anafoto.com.ar` → rewrite a `/ana-liotta`) y protege `/dashboard` y `/admin`
leyendo el JWT.

---

## 4. Los cinco flujos que importan

### 4.1 Subida de fotos

```
Cliente                     Servidor                        AWS
  │                            │                             │
  ├── POST /photos/presign ───►│ valida cuota + acceso       │
  │                            ├── crea Photo (fileSize null)│
  │◄────── URLs firmadas ──────┤                             │
  ├──────── PUT directo a S3 ──────────────────────────────► │
  ├── POST /photos/[id]/commit►│ HeadObject → fileSize       │
  │◄───────── ok ──────────────┤                             │
  │                            └─ en background:             │
  │                               generatePreview()          │
  │                                 ├ watermark  → S3 (webp) │
  │                                 ├ clean      → S3 (webp) │
  │                                 └ jpeg 2400px (memoria)  │
  │                               runOcr(bytes) ───────────► DetectText
  │                               runFaceIndex(bytes) ─────► IndexFaces
```

El archivo **nunca pasa por el servidor** en la subida: va directo del navegador
a S3 con URL firmada. El servidor solo verifica con `HeadObject` que llegó.

`generatePreview` produce tres derivados de un mismo buffer redimensionado a
2400px: la preview con marca de agua (pública), la preview limpia (dashboard del
fotógrafo) y un **JPEG en memoria** que se pasa a OCR e indexación. Ese último no
se guarda en S3 — existe solo para evitar que cada función vuelva a bajar el
original.

> **Por qué JPEG y no la preview WebP:** Rekognition solo acepta JPEG y PNG.

### 4.2 Compra

```
Carrito → POST /api/mp/checkout
            ├── valida fotos, calcula subtotal
            ├── aplica descuento (código, o el mejor automático)
            ├── platformFee = 10% · sellerNet = total − fee
            ├── crea Sale (PENDING)
            └── crea preferencia MP con marketplace_fee
                   ↓
             Mercado Pago
                   ↓
POST /api/mp/webhook  →  Sale = PAID
            ├── downloadToken (vence a los 30 días)
            ├── accrueCommissionsForSale()
            ├── email de entrega al comprador
            ├── notificación al vendedor
            └── publishSale() → toast en vivo en el dashboard
```

**Modo de prueba** (`testModeEnabled`, solo admins) saltea Mercado Pago: crea la
venta ya pagada y dispara el mismo flujo posterior. El checkout **revalida el rol
en vivo** antes de aplicar el bypass, así una degradación de permisos lo desactiva
aunque la columna quede en `true`.

### 4.3 Descarga

`/descarga/[token]` valida el token y su vencimiento. Cada foto se sirve con URL
firmada de corta duración, o todas juntas en un ZIP armado al vuelo con
`archiver`. Cada descarga queda en `DownloadLog`.

### 4.4 Búsqueda por selfie

Cada evento tiene su propia colección de Rekognition
(`cuervito-event-{eventId}`). El comprador sube una selfie, se hace
`SearchFacesByImage` contra esa colección y se devuelven las fotos cuyos
`FaceRecord` coinciden. **Una búsqueda cuesta 1 llamada**, sin importar si la
colección tiene 50 o 50.000 caras.

### 4.5 Colaboradores

```
Host invita (email + scope + %)
   └── EventCollaborator PENDING + inviteToken → email
          ↓
   /invitacion/[token]
     ├── sin sesión        → login/signup precargado
     ├── otro email        → error explícito
     ├── sin Mercado Pago  → onboarding primero
     └── acepta            → ACCEPTED + userId
          ↓
   Ya puede subir fotos al evento (uploadedById = él)
          ↓
   Al pagarse una venta: accrueCommissionsForSale()
     · ALL → % sobre todo el neto
     · OWN → % sobre la parte del neto de las fotos que él subió,
             prorrateada por precio de cada ítem
```

> **Es contabilidad, no un split de pago.** Mercado Pago acredita la venta
> completa al dueño; la comisión queda anotada como deuda entre fotógrafos. Un
> split real necesita múltiples receptores en una preferencia, que MP no soporta.
> La UI lo dice explícitamente.

`SaleCommission` congela `scope`, `pct` y monto al momento del pago: cambiar los
parámetros del colaborador después no reescribe la historia. Hay una guardia que
descarta el registro si la suma de comisiones supera el neto.

---

## 5. Infraestructura

### Layout de S3

```
cuervito/
  _platform/watermark.png
  users/{userId}/
    avatar.jpg
    watermark.png
    storefront-logo
    events/{eventId}/
      cover.jpg
      original/{photoId}.jpg        ← lo que compra el comprador
      preview/{photoId}.webp        ← con marca de agua, público
      preview-clean/{photoId}.webp  ← sin marca, dashboard del dueño
    editor/{projectId}/...
```

### CloudFront: qué pasa y qué no

Esto es la fuente de confusión más común del proyecto:

| Tráfico | Ruta | ¿CloudFront? |
|---|---|---|
| Comprador viendo/descargando | `resolveMediaUrl()` → `getCFUrl()` | **Sí** |
| Watermark bajando el original | `getS3ObjectBytes()` | **No** — SDK contra la API de S3 |
| Rekognition | `getS3ObjectBytes()` | **No** |

CloudFront intercepta requests HTTP al dominio del CDN. El pipeline del servidor
usa el SDK de AWS y entra por otra puerta, así que **no se beneficia del CDN ni
de su free tier**.

### Cuotas

`RecognitionUsage` acumula por usuario y mes en tres contadores con **unidades
distintas**:

| Acción | Contador | Suma |
|---|---|---|
| Subir 1 foto (OCR) | `ocrCalls` | 1 |
| Subir 1 foto (caras) | `indexedFaces` | **N = caras detectadas** (tope 10) |
| Búsqueda por selfie | `searchedFaces` | 1 |

`getQuotaUsage` los suma como si fueran comparables. Es una simplificación
conocida: quien sube fotos grupales quema cuota mucho más rápido con el mismo
volumen de fotos. Pendiente separarlo en tres límites.

### Cron

`POST /api/cron/cleanup` (con `Authorization: Bearer $CRON_SECRET`):
1. Borra de S3 y de la DB las fotos con `deletedAt` anterior a
   `PHOTO_RETENTION_DAYS`, en lotes de 500.
2. Limpia los `downloadToken` vencidos — la `Sale` queda para la contabilidad.

---

## 6. Sistema de diseño

CSS plano con **custom properties**, sin framework de utilidades. Un archivo
por superficie, todos importados desde el layout de su ruta.

### Temas

`<html data-theme="light|dark">`. Un script inline en el layout raíz lo resuelve
**antes del primer pintado** para evitar el flash:

```
localStorage.cuervito-theme  →  hora local (7–19 = claro)  →  oscuro
```

Todo el color sale de tokens (`--bg-base`, `--text-primary`, `--border-accent`,
`--btn-primary-bg`, …), así que el tema claro es una re-declaración de esos
tokens bajo `:root[data-theme="light"]`.

| Superficie | Tema |
|---|---|
| Landing, dashboard, admin | Sigue el toggle |
| `/descarga`, `/pago` | Sigue el toggle |
| Storefront `/[slug]` | **Siempre oscuro** — es la página de marca del fotógrafo |
| Lightbox | Siempre oscuro (va sobre imágenes) |

El storefront se fija cambiando el **atributo**, no con CSS
(`src/app/_components/storefront-theme.tsx`): script para la carga inicial y
componente cliente para las navegaciones SPA, restaurando la preferencia al
salir.

### Componentes transversales

| Componente | Qué resuelve |
|---|---|
| `<TooltipProvider />` | Un listener global: cualquier elemento con `data-tip="..."` obtiene tooltip. Evita envolver cientos de botones. |
| `<Select />` | Dropdown canónico (`.cs-*`). Reemplaza los `<select>` nativos |
| `<DateInput />` | Calendario propio; hoy marcado pero no seleccionado |
| `<Tooltip />` | Versión envolvente, para casos con contenido JSX |

---

## 7. Trampas conocidas

Cosas que ya causaron bugs y conviene tener presentes.

**El middleware corre en Edge y no puede usar Prisma.** Por eso la resolución de
dominios propios pasa por `/api/_internal/domain-map`, un route handler en Node
que el middleware consulta con caché de 60s.

**Las hojas de estilo se pisan entre rutas.** En una navegación SPA, Next mantiene
cargados los bundles de CSS de las páginas visitadas. Dos archivos que declaren la
misma clase global colisionan, y gana el que quedó último — lo que depende del
camino de navegación, así que el bug es *intermitente*. Ya pasó dos veces:
`.section` duplicada entre landing y dashboard, y un pin de tema con selector
`:root` dentro de `public-event.css`. **Regla: todo selector en una hoja
específica de ruta debe estar scopeado a un ancestro de esa ruta.**

**React pisa las clases agregadas con `classList`.** `RevealOnScroll` marcaba con
`.in`, pero los elementos cuyo `className` maneja React perdían la marca en el
siguiente render y volvían a `opacity: 0`. Se resolvió usando el atributo
`data-revealed`, que React no toca.

**Rekognition no acepta WebP.** Las previews se guardan en WebP, así que el
pipeline genera un JPEG aparte.

**`User.image` es una key de S3, no una URL.** Hay que pasarla por
`resolveAvatarUrl()` antes de ponerla en un `<img>`.

**Overlays sobre fotos:** el fondo tiene que ser vidrio oscuro en ambos temas y el
texto blanco fijo. Usar `var(--text-primary)` los vuelve negro sobre negro en modo
claro.

---

## 8. Datos de producción

Medidos sobre 30 días (referencia para dimensionar):

| Métrica | Valor |
|---|---|
| Fotos subidas / mes | 4.580 |
| Peso promedio del original | 15,2 MB (mediana 15,3 — distribución cerrada) |
| Storage acumulado | 172 GB |
| Caras indexadas | 28.911 |
| Ventas pagadas / mes | 132 |
| Fotos vendidas / mes | 437 |
| GMV / mes | AR$ 1.014.000 |
| Comisión de plataforma | AR$ 101.400 |

Costos AWS aproximados: Rekognition ~US$9/mes, storage ~US$4/mes creciendo
US$1,55 cada mes. El face storage es despreciable (US$0,29/mes).

---

## 9. Deploy

```bash
git pull
npx prisma db push     # obligatorio si cambió el schema
npm run build
pm2 restart cuervito
```

`prisma db push` hace dos cosas: sincroniza la base **y** regenera el cliente. Si
se lo saltea cuando hubo cambios de schema, el build falla con
`Property 'x' does not exist on type 'PrismaClient'` — y como el build aborta,
`.next/` queda con el bundle viejo, incluido el CSS. Es la causa habitual de
"agregaste estilos pero no se ven".

**Variables de entorno:** ~36. Las críticas son `DATABASE_URL` (usar la URL del
pooler de Supabase, no la directa — es IPv6 y el VPS puede no alcanzarla),
`AUTH_SECRET`, las de AWS, `MP_CLIENT_ID`/`MP_CLIENT_SECRET`, `RESEND_API_KEY` y
`CRON_SECRET`. La lista completa está en `src/env.js`, validada con Zod al
arrancar.

---

## 10. Pendientes

- Distribución real del pago a colaboradores (hoy es contable)
- Separar la cuota en tres límites independientes
- Lifecycle a Glacier para originales de +90 días (~US$3/mes hoy, ~US$19 en un año)
- Generación masiva desde plantillas del editor
- `Event.discipline` sigue en el schema pero ya no se usa en la UI
