# Mercado Pago Marketplace · Setup

Guía paso a paso para registrar y configurar Cuervito como **marketplace** en
Mercado Pago Argentina. El modelo de marketplace permite cobrar a nombre de los
fotógrafos (sellers) y retener una comisión de plataforma (`application_fee`)
sin que los fondos pasen por nuestra cuenta.

> **Resumen del split**
> - Plataforma Cuervito: **10%** (vía `marketplace_fee`)
> - Fotógrafo dueño de la foto: **90%** (acredita directo en su cuenta MP)
> - Las plataformas no necesitan retener IVA ni emitir factura por el fee — eso
>   queda entre el fotógrafo y el comprador.

---

## 1. Crear cuenta de developer

1. Andá a https://www.mercadopago.com.ar/developers
2. Logueate con tu cuenta de Mercado Pago (la cuenta business/comercial)
3. Aceptá los términos de developer

---

## 2. Crear la aplicación

1. En el menú lateral → **Tus integraciones** → **Crear aplicación**
2. Datos a completar:

| Campo | Valor |
|---|---|
| **Nombre** | `Cuervito` |
| **Modelo de integración** | `Pago Online` (no "Cobros presenciales") |
| **¿Qué producto integrarás?** | `Checkout Pro` |
| **¿Qué solución de pago quieres usar?** | `Checkout Pro` (marketplace soporta también Checkout API si lo necesitamos después) |
| **¿Tu app integra una plataforma de e-commerce?** | No |
| **Industria** | `Servicios > Otros` (no hay categoría de fotografía específica) |
| **Sitio web** | `https://cuervito.app` (o el que tengas) |

3. Crear → te lleva al panel de la app.

---

## 3. Activar modo Marketplace

> ⚠️ **Importante**: este paso requiere aprobación manual de Mercado Pago.
> Demora entre 24 hs y 7 días. Mientras tanto trabajamos en sandbox.

1. Dentro de la app → **Detalles de la aplicación** → buscar la sección
   **"¿Tu app es un marketplace?"** → activar.
2. MP te va a pedir:
   - Descripción del modelo de negocio
   - Cómo se gana plata la plataforma (respuesta: "comisión del 10% sobre cada
     venta de fotos, retenida automáticamente como marketplace_fee")
   - Volumen estimado mensual de transacciones
   - URL de términos y condiciones (después la armamos)
3. Mandás → esperás.

Mientras esperás, podés probar todo en sandbox sin restricciones.

---

## 4. Credenciales

En el panel de la app vas a ver dos sets de credenciales:

### Producción
- `CLIENT_ID` (también llamado App ID)
- `CLIENT_SECRET`
- `Access Token` de producción (no lo usamos directo — generamos los del seller via OAuth)
- `Public Key` (para Checkout Pro/Bricks)

### Sandbox
- Mismos campos pero con prefijo `TEST-`
- Usuarios de prueba: en MP Developers → **Cuentas de prueba** → crear al menos 2:
  - Una de tipo **Comprador**
  - Una de tipo **Vendedor** (Argentina)

Los **emails y passwords** de los test users los guardás en un password manager.
Cada test user tiene su propio Access Token, que vas a necesitar para simular
el flujo de OAuth.

---

## 5. OAuth del seller (vincular fotógrafo)

Cuando el fotógrafo termina el onboarding y aprieta **"Conectar Mercado Pago"**,
lo redirigimos al flujo OAuth de MP:

```
https://auth.mercadopago.com.ar/authorization
  ?client_id={CLIENT_ID}
  &response_type=code
  &platform_id=mp
  &redirect_uri=https://cuervito.app/api/mp/oauth/callback
  &state={photographerId}
```

MP redirige de vuelta con `?code=...&state=...`. Intercambiamos el `code` por
tokens:

```http
POST https://api.mercadopago.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id={CLIENT_ID}
&client_secret={CLIENT_SECRET}
&grant_type=authorization_code
&code={CODE}
&redirect_uri=https://cuervito.app/api/mp/oauth/callback
```

Response:
```json
{
  "access_token": "APP_USR-...",
  "public_key": "APP_USR-...",
  "refresh_token": "TG-...",
  "user_id": 123456789,
  "live_mode": true,
  "expires_in": 15552000
}
```

Guardamos en la tabla `PhotographerPayment`:
- `mpUserId` (= `user_id` de MP)
- `mpAccessToken` (cifrado en DB)
- `mpRefreshToken` (cifrado)
- `mpPublicKey`
- `mpTokenExpiresAt` (now + `expires_in` segundos)
- `mpLiveMode`

> El access token dura **6 meses** (15.552.000 s). Tenemos que refrescarlo con
> el refresh_token antes de que expire.

---

## 6. Crear una preference con split de comisión

Cuando un comprador va a pagar fotos del fotógrafo X:

```http
POST https://api.mercadopago.com/checkout/preferences
Authorization: Bearer {mpAccessToken DEL FOTÓGRAFO X}
Content-Type: application/json

{
  "items": [
    { "title": "3 fotos · Maratón BA", "quantity": 1, "unit_price": 7200, "currency_id": "ARS" }
  ],
  "marketplace": "Cuervito",
  "marketplace_fee": 720,                     // 10% en pesos
  "payer": { "email": "cliente@gmail.com" },
  "back_urls": {
    "success": "https://cuervito.app/pago/exito?saleId={saleId}",
    "failure": "https://cuervito.app/pago/error?saleId={saleId}",
    "pending": "https://cuervito.app/pago/pendiente?saleId={saleId}"
  },
  "auto_return": "approved",
  "notification_url": "https://cuervito.app/api/mp/webhook?source=marketplace",
  "external_reference": "{saleId}",
  "statement_descriptor": "CUERVITO"
}
```

**Puntos clave**:
- El `Authorization` usa el access token **del fotógrafo**, no el nuestro.
- `marketplace_fee` está en la **misma moneda** que `unit_price` (ARS).
- `external_reference` = nuestro `Sale.id` — el webhook nos lo devuelve.

Response devuelve `init_point` (URL de Checkout Pro) que redirigimos al cliente.

---

## 7. Webhook de notificación

MP nos manda `POST` a `/api/mp/webhook?source=marketplace` cada vez que cambia
el estado de un pago. Body típico:

```json
{
  "action": "payment.created",
  "api_version": "v1",
  "data": { "id": "1234567890" },
  "date_created": "2026-05-11T...",
  "id": 12345,
  "live_mode": true,
  "type": "payment",
  "user_id": "123456789"
}
```

Flujo del handler:

1. Validar firma (`x-signature` header → HMAC SHA256 con `MP_WEBHOOK_SECRET`)
2. `GET https://api.mercadopago.com/v1/payments/{data.id}` con el access token
   del fotógrafo (lo buscamos por `user_id` que viene en el webhook)
3. Leer `external_reference` → `saleId`
4. Actualizar `Sale.status` según `payment.status`:
   - `approved` → `PAID` (disparar email de descarga al comprador)
   - `rejected` → `FAILED`
   - `pending` / `in_process` → `PENDING`
5. Devolver `200 OK` rápido — MP reintenta si tarda más de 22 s.

---

## 8. Reembolsos

Si el fotógrafo o admin necesita reembolsar una venta:

```http
POST https://api.mercadopago.com/v1/payments/{paymentId}/refunds
Authorization: Bearer {mpAccessToken DEL FOTÓGRAFO}
```

MP devuelve los 90% al comprador desde la cuenta del fotógrafo y el 10% nuestro
del marketplace fee también vuelve. No requiere acción de la plataforma.

Para reembolsos parciales, mandás `amount` en el body.

---

## 9. Variables de entorno (Cuervito `.env`)

```bash
# Mercado Pago — App credentials (de la app marketplace)
MP_CLIENT_ID="..."
MP_CLIENT_SECRET="..."
MP_PUBLIC_KEY="APP_USR-..."           # de la app, para Checkout Pro frontend
MP_WEBHOOK_SECRET="..."               # generado en panel MP → Webhooks → Configurar

# Modo
MP_ENVIRONMENT="sandbox"              # sandbox | production

# URLs públicas (para back_urls y redirect_uri)
NEXT_PUBLIC_BASE_URL="https://cuervito.app"
```

---

## 10. Configurar el webhook en el panel de MP

Una vez que tenés deploy:

1. Panel de la app → **Webhooks** → **Configurar notificaciones**
2. URL: `https://cuervito.app/api/mp/webhook`
3. Eventos a suscribir:
   - `payment` (todos los sub-eventos: created, updated)
   - `merchant_order` (opcional, para tracking de órdenes)
4. Copiar el **secret** que MP te muestra → guardar en `MP_WEBHOOK_SECRET`

---

## 11. Testing

### Cuentas de test
- Comprador test: `TESTUSER123456_buyer@testuser.com` + password generada por MP
- Vendedor test: `TESTUSER789012_seller@testuser.com` + password generada por MP

### Tarjetas de test
| Tipo | Número | Resultado |
|---|---|---|
| Aprobada | `5031 7557 3453 0604` | OK |
| Rechazada por fondos | `5031 4332 1540 6351` | INSUFFICIENT_AMOUNT |
| Pendiente | `5031 1133 2080 0001` | PENDING |

CVV: cualquier 3 dígitos · Vencimiento: cualquier fecha futura · DNI: `12345678`

### Flujo de prueba completo
1. Logueate como vendedor test en MP → autorizá la app de Cuervito (OAuth) → guardamos sus tokens
2. Logueate como comprador test en MP en otra ventana de incógnito
3. En Cuervito, simulá comprar fotos del vendedor → te redirige a Checkout Pro
4. Pagás con tarjeta test → MP te redirige a `back_urls.success`
5. MP dispara webhook → `Sale` queda en `PAID`
6. Verificá en panel del vendedor test que recibió el 90%
7. Verificá en tu cuenta marketplace (TEST) que recibiste el 10%

---

## 12. Pasaje a producción

1. La app debe estar **aprobada como marketplace** (paso 3)
2. Cambiar `MP_ENVIRONMENT=production`
3. Usar credenciales sin prefijo `TEST-`
4. Webhook URL apunta al dominio de producción
5. **Probar con una venta real de bajo monto antes de anunciar**

---

## Referencias

- Docs oficial Marketplace: https://www.mercadopago.com.ar/developers/es/docs/marketplace/landing
- Checkout Pro: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro/landing
- API reference: https://www.mercadopago.com.ar/developers/es/reference
- Webhook docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
