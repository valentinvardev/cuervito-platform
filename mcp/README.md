# encontrate-ops-mcp

Servidor MCP remoto con métricas agregadas y salud técnica de encontrate.app, para agentes de operaciones (Cursor, Grok y cualquier cliente MCP).

Transporte **Streamable HTTP** sin estado, en `POST /mcp`, con token en `Authorization: Bearer`.

**Sólo lectura y cero datos personales.** Ninguna herramienta escribe, actualiza, borra, redeploya ni cambia configuración. Ninguna respuesta trae mails, nombres, IDs, URLs de fotos, rostros, dorsales individuales ni montos por compra.

## Contenido

- [Cómo se garantiza](#cómo-se-garantiza)
- [Herramientas](#herramientas)
- [Métricas que no existen](#métricas-que-no-existen)
- [Variables de entorno](#variables-de-entorno)
- [Rol de base de datos de sólo lectura](#rol-de-base-de-datos-de-sólo-lectura)
- [Deploy](#deploy)
- [Conectar un cliente](#conectar-un-cliente)
- [Probar](#probar)
- [Límites conocidos](#límites-conocidos)

## Cómo se garantiza

No depende de una sola cosa. Son capas independientes, y cualquiera alcanzaría sola:

| Capa | Qué hace | Dónde |
|---|---|---|
| Rol de base | Un usuario de Postgres con `SELECT` sólo sobre las columnas que se usan. No puede leer un mail aunque quiera. | [SQL abajo](#rol-de-base-de-datos-de-sólo-lectura) |
| Transacción | Toda consulta corre en `BEGIN TRANSACTION READ ONLY` con tope de tiempo. Postgres rechaza cualquier escritura. | `src/db.ts` |
| Consultas | Sólo agregados (`count`, `sum`, `max`). Ninguna nombra una columna con datos personales. Lo verifica un test sobre el texto de cada consulta. | `src/metricas/`, `test/sql.test.ts` |
| Salida | Cada respuesta se recorre entera antes de salir. Cualquier clave que no esté en una **lista de permitidas** la corta. Cada texto se revisa buscando mails, URLs, IDs, teléfonos y claves de S3. | `src/privacidad.ts` |
| Montos | Un total con menos de 5 compras se informa como `null`: con una sola compra, el total sería su monto. | `src/privacidad.ts` |
| Errores | Nunca se reenvía el texto de un error de Postgres o de AWS. El agente recibe un código y un mensaje fijo. | `src/errores.ts` |

La lista de permitidas es a propósito: una lista de prohibidas siempre queda corta. Agregar un campo nuevo obliga a sumarlo a mano en `src/privacidad.ts`, y si alguien se olvida, los tests fallan.

## Herramientas

Todas se anuncian con `readOnlyHint: true` y `destructiveHint: false`. Todas devuelven el resultado dos veces: como texto JSON y como `structuredContent`.

Los períodos se cuentan en días calendario de `METRICS_TZ` (Buenos Aires por defecto), no en UTC.

| Herramienta | Entrada | Para qué |
|---|---|---|
| `ping` | — | Saber que el servidor responde y qué versión corre. No toca la base. |
| `get_health` | — | Estado de ahora del procesamiento de fotos y de los pagos, con alertas. |
| `get_activation` | período | Embudo de la cohorte de fotógrafos registrados en el período. |
| `get_usage` | período | Eventos creados, fotos subidas, búsquedas. |
| `get_sales` | período | Totales de ventas, por moneda. |
| `get_weekly_snapshot` | `week_start?`, `include_previous_week?` | Todo lo anterior para una semana, con deltas contra la anterior. |
| `get_aws_costs` | `month?` | Gasto de AWS del mes: estimado de encontrate y, si está activado, el medido de la cuenta. |

**Período**, para las que lo aceptan:

| Campo | Valores |
|---|---|
| `period` | `today` · `last_7d` (hoy y los 6 anteriores) · `last_30d` (hoy y los 29 anteriores) · `custom`. Por defecto `last_7d`. |
| `from`, `to` | Con `custom`: `YYYY-MM-DD`, los dos inclusive. Hasta 366 días. |

Los números de los ejemplos son **inventados**.

### `ping`

```json
{ "ok": true, "service": "encontrate-ops-mcp", "version": "1.0.0", "timestamp": "2026-09-23T18:00:00.000Z", "generated_at": "2026-09-23T18:00:00.000Z" }
```

### `get_health`

```json
{
  "status": "degraded",
  "photo_processing": {
    "status": "degraded",
    "pending": 12,
    "pending_over_1h": 3,
    "in_flight": 2,
    "parked_after_retries": 3,
    "processed_last_hour": 180,
    "last_success_age_s": 14,
    "timings": { "samples": 20, "median_total_ms": 12400, "p90_total_ms": 15100, "median_download_ms": 8900 }
  },
  "payments": {
    "status": "ok",
    "window_hours": 24,
    "paid": 30,
    "failed": 1,
    "failure_rate": 0.0323,
    "pending_unconfirmed": 0,
    "abandoned_checkouts": 9
  },
  "errors": [
    { "source": "photo_processing", "code": "tope", "count": 3 },
    { "source": "payments", "code": "payment_failed", "count": 1 }
  ],
  "alerts": [
    { "severity": "warning", "code": "photos_parked", "message": "3 fotos quedaron apartadas después de 4 intentos fallidos: la cola ya no las toma y no se ven en las tiendas hasta reintentarlas a mano." }
  ],
  "aws": { "available": false, "unavailable_reason": "CloudWatch no está configurado: faltan AWS_REGION y CLOUDWATCH_ALARM_PREFIX." },
  "generated_at": "2026-09-23T18:00:00.000Z"
}
```

Cada `status` es `ok`, `degraded` (mirarlo hoy) o `down` (hacer algo ya). El general es el peor de los dos.

**Procesamiento de fotos.** Una foto está *pendiente* si se subió y todavía no tiene vista previa con marca de agua: hasta tenerla, no aparece en la tienda.

| Estado | Cuándo |
|---|---|
| `down` | Hay fotos que la cola todavía va a tomar y no terminó ninguna en 30 minutos. |
| `degraded` | Alguna lleva más de una hora esperando, quedó apartada tras 4 intentos, o bajar un original de S3 tarda más de 30 s de mediana. |

Las fotos *apartadas* no cuentan para `down`: la cola deja de intentarlas a propósito. Diez fotos apartadas con la cola ociosa no es "el procesador se cayó", es "hay diez fotos para reintentar". `timings` sale de las últimas 20 fotos procesadas en las últimas 6 horas; con menos de 3, es `null` y la razón va en `unavailable_reason`.

**Pagos.** Ventana de 24 horas. `failure_rate` es fallidas sobre pagadas más fallidas.

| Estado | Cuándo |
|---|---|
| `down` | Con al menos 5 intentos, falla la mitad o más. |
| `degraded` | Con al menos 5 intentos, falla el 20 % o más; o hay 5 o más ventas sin confirmar hace más de una hora y son más que las confirmadas, que suele ser el webhook. |

`abandoned_checkouts` son ventas sin confirmar de más de 24 horas en los últimos 30 días: gente que abrió el checkout y se fue. Es normal y no dispara alertas.

**Errores.** Los de procesamiento son los **vigentes**: fotos que hoy siguen sin vista previa y con error. No hay una fecha de cuándo falló cada una (en los fallos permanentes la base no la guarda), así que se cuentan las que siguen rotas en vez de inventar una ventana. Se agrupan por código (`tope`, `s3`, `corrupta`, `cuota`, `rek`, `error`, y `otro` para cualquier otro). El texto del error nunca se lee. Los de pagos son los de las últimas 24 horas.

### `get_activation`

```json
{
  "period": { "label": "last_30d", "from": "2026-08-25", "to": "2026-09-23", "timezone": "America/Argentina/Buenos_Aires" },
  "photographers_registered": 20,
  "photographers_with_event": 8,
  "photographers_with_photos": 5,
  "registered_no_event": 12,
  "event_no_photos": 3,
  "rates": { "with_event": 0.4, "with_photos": 0.25, "event_to_photos": 0.625 },
  "generated_at": "2026-09-23T18:00:00.000Z"
}
```

Es una **cohorte**: los fotógrafos registrados en el período, y lo que hicieron **hasta el fin del período**, no hasta hoy. Así dos períodos se comparan en igualdad de condiciones; contando hasta hoy, un mes viejo siempre se vería mejor porque tuvo más tiempo. Una foto cuenta si terminó de subirse y no se borró. Las tasas son `null` si el denominador es cero.

### `get_usage`

```json
{
  "period": { "label": "last_7d", "from": "2026-09-17", "to": "2026-09-23", "timezone": "America/Argentina/Buenos_Aires" },
  "events_created": 6,
  "photos_uploaded": 2400,
  "face_searches": 150,
  "dorsal_searches": null,
  "unavailable_reason": { "dorsal_searches": "Las búsquedas por dorsal no se registran en ninguna tabla: la búsqueda existe, pero no deja rastro." },
  "generated_at": "2026-09-23T18:00:00.000Z"
}
```

`photos_uploaded` cuenta las fotos que terminaron de subirse y no se borraron. `face_searches` cuenta cada búsqueda por cara registrada.

### `get_sales`

```json
{
  "period": { "label": "last_7d", "from": "2026-09-17", "to": "2026-09-23", "timezone": "America/Argentina/Buenos_Aires" },
  "purchases_count": 40,
  "purchases_gross": [{ "currency": "ARS", "amount": 120000, "suppressed": false }],
  "payments_failed": 2,
  "payments_rejected": null,
  "failure_rate": 0.0476,
  "gifts_count": 0,
  "unavailable_reason": { "payments_rejected": "Mercado Pago informa rechazos y cancelaciones, pero el webhook los guarda a los dos como FAILED: están incluidos en payments_failed y no se pueden separar." },
  "generated_at": "2026-09-23T18:00:00.000Z"
}
```

Una compra es una venta pagada, por la fecha de pago: la misma definición que el panel de métricas del admin, así los dos números coinciden. `amount` va en unidades de moneda, no en centavos. Con menos de `MIN_GROUP_SIZE` compras en una moneda, `amount` es `null`, `suppressed` es `true` y la razón va en `unavailable_reason.purchases_gross`. Los regalos van aparte porque no son plata cobrada.

### `get_weekly_snapshot`

| Campo | Valores |
|---|---|
| `week_start` | Lunes de la semana, `YYYY-MM-DD`. Sin esto, la **última semana completa**. |
| `include_previous_week` | Por defecto `true`: agrega la semana anterior y los deltas. |

```json
{
  "week": { "label": "week", "from": "2026-09-14", "to": "2026-09-20", "timezone": "America/Argentina/Buenos_Aires" },
  "activation": { "photographers_registered": 7, "…": "igual que get_activation, sin period" },
  "usage": { "events_created": 6, "…": "igual que get_usage, sin period" },
  "sales": { "purchases_count": 40, "…": "igual que get_sales, sin period" },
  "health_now": { "status": "ok", "photo_processing": "ok", "payments": "ok", "alerts_count": 0 },
  "previous_week": { "week": { "from": "2026-09-07", "to": "2026-09-13", "…": "" }, "activation": {}, "usage": {}, "sales": {} },
  "deltas": {
    "photos_uploaded": { "current": 1800, "previous": 1200, "change": 600, "change_pct": 0.5 },
    "purchases_count": { "current": 40, "previous": 25, "change": 15, "change_pct": 0.6 },
    "…": "también photographers_registered, photographers_with_event, photographers_with_photos, events_created, face_searches, payments_failed, gifts_count"
  },
  "generated_at": "2026-09-23T18:00:00.000Z"
}
```

`health_now` es la salud de **ahora**, no la de esa semana: no hay historia de salud guardada, y armarla sería inventarla. `change_pct` es `null` cuando la semana anterior es cero.

### `get_aws_costs`

| Campo | Valores |
|---|---|
| `month` | Mes en **UTC**, `YYYY-MM`, que es como factura AWS. Sin esto, el mes en curso. Hasta 24 meses atrás. |

```json
{
  "month": { "label": "month", "from": "2026-09-01", "to": "2026-09-30", "timezone": "UTC", "days_elapsed": 23.2, "days_in_month": 30, "is_current_month": true },
  "estimated": {
    "scope": "encontrate",
    "total_usd": 9.8,
    "projected_month_usd": 12.7,
    "components": [
      { "service": "rekognition", "item": "detect_text", "quantity": 1500, "unit": "images", "unit_price_usd": 0.001, "cost_usd": 1.5, "basis": "counted" },
      { "service": "s3", "item": "storage", "quantity": 80, "unit": "GB-months", "unit_price_usd": 0.023, "cost_usd": 1.84, "basis": "estimated" },
      { "service": "s3", "item": "transfer_out_processing", "quantity": 22, "unit": "GB", "unit_price_usd": 0.09, "cost_usd": 1.98, "basis": "estimated" }
    ],
    "not_included": [{ "item": "cloudfront", "reason": "Los bytes que sirve CloudFront no quedan en la base. …" }],
    "assumptions": ["Precios de lista de us-east-2, del primer escalón y sin capa gratuita: …"],
    "prices_verified_on": "2026-09-24",
    "price_region": "us-east-2"
  },
  "measured": { "available": false, "unavailable_reason": "Cost Explorer no está activado en este servidor: …" },
  "generated_at": "2026-09-23T18:00:00.000Z"
}
```

Son dos números distintos, y a propósito:

- **`estimated`** es sólo de encontrate. Es el uso que registra la base por los precios de lista de us-east-2. Cada componente dice su calidad en `basis`: `counted` si la cantidad está contada una por una (los llamados a Rekognition, que la app cuenta antes de hacerlos) o `estimated` si sale de tamaños y supuestos (almacenamiento, pedidos y transferencia de S3). `projected_month_usd` proyecta el mes en curso al ritmo de lo que va, y es `null` en meses pasados.
- **`measured`** es la factura real, de Cost Explorer. Es de **toda la cuenta de AWS**, que comparte encontrate con otro proyecto, así que no se compara uno a uno con el estimado. Cuando está, `comparison` dice qué parte de la cuenta es de encontrate (`estimated_share_of_account`) y si lo medido de Rekognition coincide con lo contado (`rekognition_ratio`): un valor muy por encima de 1 indica llamados que la app no está contando.

Los precios son del primer escalón y **sin capa gratuita**. Las franquicias gratuitas de AWS (100 GB de salida por mes, 1 TB de CloudFront) son por cuenta, y con la cuenta compartida no se puede saber cuánto le toca a encontrate. Los precios se verificaron el 24/9/2026 contra la API pública de precios de AWS y las páginas oficiales; están con su SKU en `src/costos/precios.ts`.

Lo que no se puede saber desde la base va en `not_included`, con la razón: los bytes que sirve CloudFront, el cómputo de la Lambda, los objetos chicos (portadas, logos) y lo que gasta el otro proyecto.

**Transfer Acceleration.** El recargo es una parte grande del gasto, así que `S3_TRANSFER_ACCELERATION` acepta la fecha en que se prendió: con `2026-09-20`, septiembre la paga sólo desde ese día. La proyección supone que lo que falta del mes va todo acelerado.

**Activar el gasto medido.** Hace falta un usuario de IAM con esta política y nada más, y sus claves en el `.env`:

```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": ["ce:GetCostAndUsage", "ce:GetCostForecast"], "Resource": "*" }]
}
```

```
AWS_COST_EXPLORER=true
AWS_ACCESS_KEY_ID=…
AWS_SECRET_ACCESS_KEY=…
```

Cost Explorer tiene que estar habilitado en la cuenta: si nunca se abrió, se abre una vez desde la consola de facturación y tarda hasta 24 horas en tener datos. Cada consulta cuesta USD 0,01, así que el resultado se guarda seis horas por mes y los errores cinco minutos: aunque un agente pregunte en loop, son unos centavos por día.

### Errores

Un error sale con `isError: true` y este cuerpo:

```json
{ "error": { "code": "invalid_period", "message": "from no puede ser posterior a to." } }
```

| Código | Cuándo |
|---|---|
| `invalid_period` | Período mal armado: falta `from` o `to`, fecha inexistente, más de 366 días, `week_start` que no es lunes. |
| `privacy_violation` | La respuesta tenía algo que no debería. No se envió. El mensaje dice dónde, nunca qué valor. |
| `db_timeout` | La consulta pasó el tope de tiempo. |
| `db_unavailable` | No se pudo conectar a la base. |
| `internal` | Cualquier otra cosa. |

Por HTTP: `401 unauthorized` sin token o con uno inválido, `429 rate_limited` con `Retry-After`, `413` para cuerpos de más de 64 KB, `405` para cualquier método que no sea `POST`.

## Métricas que no existen

No se inventan. Salen como `null`, con la razón en `unavailable_reason`:

| Campo | Por qué |
|---|---|
| `dorsal_searches` | Las búsquedas por dorsal no quedan registradas en ninguna tabla. Para tenerlas, la app tendría que registrarlas. |
| `payments_rejected` | El webhook de Mercado Pago guarda `rejected` y `cancelled` los dos como `FAILED`. Están adentro de `payments_failed`. |
| `timings` | Sólo si hubo menos de 3 fotos procesadas en las últimas 6 horas. |
| `aws` | Sólo si CloudWatch no está configurado. |
| `measured` en `get_aws_costs` | Sólo si Cost Explorer no está activado, no tiene permiso o no tiene datos. La razón dice cuál. |

## Variables de entorno

| Variable | Obligatoria | Por defecto | Qué es |
|---|---|---|---|
| `DATABASE_URL` | sí | — | Conexión a Postgres. Usá el rol de sólo lectura de abajo. |
| `MCP_TOKEN` | sí | — | Token de los clientes. Mínimo 32 caracteres. |
| `PORT` | | `8787` | |
| `METRICS_TZ` | | `America/Argentina/Buenos_Aires` | Zona para "hoy" y las semanas. |
| `DATABASE_SSL` | | `require` | `off`, `require` o `verify`. |
| `DB_STATEMENT_TIMEOUT_MS` | | `8000` | Tope por consulta. |
| `RATE_LIMIT_PER_MIN` | | `60` | Pedidos por minuto con el token. |
| `AUTH_FAILURES_PER_MIN` | | `20` | Intentos fallidos por minuto y por IP. |
| `MIN_GROUP_SIZE` | | `5` | Compras mínimas para informar un monto. |
| `TRUST_PROXY` | | `false` | `true` detrás de nginx, Railway o Fly, para leer la IP de `X-Forwarded-For`. |
| `AWS_REGION` | | — | Con la siguiente, activa las alarmas de CloudWatch. |
| `CLOUDWATCH_ALARM_PREFIX` | | — | Prefijo de las alarmas a informar. Necesita `cloudwatch:DescribeAlarms`. |
| `S3_TRANSFER_ACCELERATION` | | `false` | `true`, `false` o la fecha `YYYY-MM-DD` desde la que la app usa Transfer Acceleration. |
| `PHOTO_RETENTION_DAYS` | | `30` | Días que una foto borrada sigue en S3. El mismo valor que la app. |
| `AWS_COST_EXPLORER` | | `false` | `true` para leer el gasto medido. Necesita un usuario de IAM (ver `get_aws_costs`). |

El servidor **no arranca** si falta `DATABASE_URL`, si `MCP_TOKEN` tiene menos de 32 caracteres, o si la zona horaria no existe. Es a propósito: un servidor de métricas que levanta sin token queda abierto.

Para generar un token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

**Por qué `DATABASE_URL` y no la service role de Supabase.** La service role es una clave para la API REST, y esa API no hace agregados arbitrarios como `count(*) filter (…)` sin crear funciones en la base. Además esa clave puede escribir y se salta todo control de filas. Una conexión directa con un rol de sólo lectura hace las consultas que hacen falta y, por construcción, no puede escribir.

## Rol de base de datos de sólo lectura

Correlo una vez en el editor SQL de Supabase. Es opcional —el servidor funciona con cualquier conexión, porque cada consulta es de sólo lectura igual—, pero es la capa que garantiza que ni un cambio futuro en el código pueda leer un mail.

```sql
-- 1. El rol. Generá una contraseña larga.
create role mcp_lectura with login password 'GENERAR-UNA-CONTRASEÑA-LARGA'
  nosuperuser nocreatedb nocreaterole noinherit noreplication;

-- 2. Todo lo que haga es de sólo lectura y con tope de tiempo, aunque se olvide.
alter role mcp_lectura set default_transaction_read_only = on;
alter role mcp_lectura set statement_timeout = '10s';

-- 3. Sólo las columnas que se usan. Ninguna con datos de personas.
grant usage on schema public to mcp_lectura;
grant select (id, role, "createdAt") on "User" to mcp_lectura;
grant select (id, "ownerId", "createdAt") on "Event" to mcp_lectura;
grant select (id, "ownerId", "createdAt", "fileSize", "deletedAt", "previewKey",
              "previewGeneratedAt", "processAttempts", "processError", "processLeaseUntil")
  on "Photo" to mcp_lectura;
grant select (status, currency, "createdAt", "paidAt", "totalCents") on "Sale" to mcp_lectura;
grant select ("createdAt") on "FaceSearchLog" to mcp_lectura;
grant select (key, value) on "Setting" to mcp_lectura;

-- Para get_aws_costs.
grant select (year, month, "ocrCalls", "indexRequests", "searchedFaces") on "RecognitionUsage" to mcp_lectura;
grant select ("createdAt") on "FaceRecord" to mcp_lectura;
grant select ("photoId", "saleId", "createdAt") on "DownloadLog" to mcp_lectura;
grant select ("saleId", "photoId") on "SaleItem" to mcp_lectura;
```

Con el pooler de Supabase, el usuario de la URL lleva el ID del proyecto:

```
postgresql://mcp_lectura.PROJECT_REF:CONTRASEÑA@HOST.pooler.supabase.com:6543/postgres
```

Después corré `npm run probar`: si falta algún permiso, la herramienta que lo necesita falla en ese momento, no en producción.

> Si algún día se activa RLS en estas tablas, este rol vería **cero filas** y las métricas saldrían en cero, que parece un número válido. Habría que agregarle una política de lectura.

## Deploy

Cualquier lugar que corra Node 20+ o Docker y dé HTTPS. Tres opciones.

**A. En el mismo VPS que la app, con pm2 y nginx.** No hace falta ninguna cuenta nueva. Consume casi nada: son consultas agregadas cada tanto, con un tope de 60 por minuto.

```bash
cd mcp
cp .env.example .env         # completar DATABASE_URL y MCP_TOKEN
npm ci && npm run build
pm2 start ecosystem.config.cjs && pm2 save
```

Y en el bloque `server` del dominio, en nginx:

```nginx
location = /_ops/mcp {
    proxy_pass http://127.0.0.1:8787/mcp;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 60s;
    client_max_body_size 64k;
}
```

La URL queda en `https://DOMINIO/_ops/mcp`. No abras el puerto 8787 en el firewall: sólo nginx tiene que llegar.

**B. Railway o Render.** Nuevo servicio desde este repo, con *root directory* `mcp`. Detectan el `Dockerfile`. Cargá las variables y listo; la plataforma da la URL HTTPS.

**C. Fly.io.**

```bash
cd mcp
fly launch --no-deploy        # detecta el Dockerfile
fly secrets set DATABASE_URL=… MCP_TOKEN=… TRUST_PROXY=true
fly deploy
```

En B y C, el chequeo de salud de la plataforma va contra `GET /healthz`, que no pide token ni devuelve datos.

## Conectar un cliente

La URL es la del deploy terminada en `/mcp` (o `/_ops/mcp` con la opción A). El header es:

```
Authorization: Bearer TU_TOKEN
```

**Cursor**, en `~/.cursor/mcp.json` o en `.cursor/mcp.json` del proyecto:

```json
{
  "mcpServers": {
    "encontrate-ops": {
      "url": "https://DOMINIO/_ops/mcp",
      "headers": { "Authorization": "Bearer TU_TOKEN" }
    }
  }
}
```

**Grok y otros clientes.** Se agrega como servidor MCP remoto con la URL y el header de arriba. Si el cliente pide el token en un campo aparte, va el token solo, sin `Bearer`.

**curl**, para ver una respuesta cruda. Al ser sin estado, se puede llamar a una herramienta sin inicializar:

```bash
curl -s https://DOMINIO/_ops/mcp \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -H "authorization: Bearer TU_TOKEN" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_health","arguments":{}}}'
```

## Probar

```bash
npm test                                   # más de 600 tests, sin base ni red
npm run probar                             # levanta el servidor y lo recorre con el cliente MCP oficial
MCP_URL=https://… npm run probar           # lo mismo contra un servidor ya deployado
```

`npm run probar` necesita `MCP_TOKEN` y, sin `MCP_URL`, también `DATABASE_URL`. Antes de nada confirma que la transacción sea de sólo lectura; si no lo es, no sigue. Después lista las herramientas, verifica que todas estén marcadas de sólo lectura, llama a cada una e imprime la respuesta, y prueba dos pedidos inválidos para ver que se contesten bien.

Con el [MCP Inspector](https://github.com/modelcontextprotocol/inspector):

```bash
npx @modelcontextprotocol/inspector
```

Transporte *Streamable HTTP*, la URL, y el header `Authorization` en la configuración.

**Qué cubren los tests.** Que ninguna respuesta de ninguna herramienta tenga una clave fuera de la lista de permitidas ni un texto con forma de mail, URL, ID o teléfono. Que las claves de datos personales típicas se rechacen, también anidadas. Que un dato personal que llegue a la respuesta la corte, y que el error no lo repita. Que ninguna consulta escriba, haga `select *` o nombre una columna personal. Que los montos con pocas compras se supriman. Los períodos en la zona correcta, con horario de verano incluido. Autenticación, límites y tamaños por HTTP, con un cliente MCP de verdad.

## Límites conocidos

- **Restar dos períodos.** El mínimo de compras protege cada consulta, pero dos períodos que se solapan se pueden restar: si lunes a miércoles dio 9 compras y lunes a martes 8, la resta es el monto de la compra del miércoles. Queda un monto sin nadie asociado —nunca sale quién compró—, pero es un límite del método y no se esconde.
- **El límite de pedidos es por instancia.** Vive en memoria. Con varias instancias, cada una cuenta el suyo.
- **La salud es de ahora.** No hay historia; el snapshot semanal lo aclara con `health_now`.
- **Los errores de procesamiento no tienen fecha.** Se informan los vigentes, no los de las últimas 24 horas.
