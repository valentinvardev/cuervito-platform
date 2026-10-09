# Lambda de derivados

Genera las tres versiones de cada foto —la vista previa con marca de agua, la
limpia para el panel del fotógrafo y la miniatura de la grilla— al lado de S3.

## Por qué

En el VPS, bajar cada original de 15 MB tarda unos diez segundos, y el trabajo
de imagen pasa de a uno en un solo núcleo. Con un evento grande, la cola no
llegaba a la par de las subidas. En la Lambda el original llega en menos de un
segundo, sin pagar la salida de S3, y corren muchas a la vez; el VPS sólo espera
la respuesta y queda libre para el sitio.

## Cómo encaja

La cola sigue en el VPS (`src/server/cola-fotos.ts`): el lease, los reintentos y
la escritura en la base no cambian. Cuando le toca una foto, el VPS le pide los
derivados a esta función (`src/server/derivados-lambda.ts`) con todo resuelto:
dónde está el original, dónde van las versiones, qué claves viejas borrar y la
marca de agua ya armada. La función baja, procesa, sube y contesta; nunca toca
la base.

El trabajo de imagen es el mismo código en los dos lados
(`src/server/derivados.ts` y `src/server/marca-agua-capa.ts`), y la elección de
la marca es una sola función (`elegirMarca` en `watermark.ts`). Lo único que
depende del servidor —armar la unidad de la marca con las fuentes del repo— se
hace en el VPS y viaja armado. Las dos usan sharp 0.34.5; si se actualiza en la
app, hay que actualizarlo acá y volver a desplegar.

**Nunca es obligatoria.** Sin `PROCESADOR_LAMBDA`, o si la función falla, la
foto se procesa en el VPS como siempre. La unidad viaja armada para un ancho:
2400 px, o el de la vista previa anterior si la foto ya se procesó y es más
angosta (así se regenera la marca de un recorte sin pasar por el VPS). Si la
foto sale de otro ancho —una angosta en su primera pasada— vuelve al VPS, igual
que las que no se pueden abrir, para que sea el VPS el que decida si el error
es permanente.
Si la función falla cinco veces seguidas, el VPS deja de pedírsela cinco minutos
y después prueba con una sola foto. Si AWS contesta que la cuenta tiene demasiadas
Lambdas en curso, esa foto se hace en el VPS sin contarlo como falla. El estado
(pausa, último error, cuántas fotos hizo cada lado en la hora) queda en `Setting`
`procesador:lambda` y lo informa `get_health` del MCP de operaciones.

## Desplegar

En la consola de AWS, abrí **CloudShell** en la región del bucket y corré:

```bash
git clone --depth 1 https://github.com/valentinvardev/cuervito-platform.git
cd cuervito-platform/cuervito/lambda-derivados
BUCKET=<el bucket> USUARIO_VPS=<el usuario de IAM de las claves del VPS> bash desplegar.sh
```

El script toma la región del bucket, arma el paquete (con sharp para Linux),
crea el rol de la función —sólo puede leer originales y escribir derivados—,
crea o actualiza la función, le da al usuario del VPS permiso para invocarla, la
prueba con un pedido vacío y te dice qué poner en el `.env`. Correrlo de nuevo
actualiza todo.

En el `.env` de la app en el VPS van las líneas que imprime al final:

```
PROCESADOR_LAMBDA=cuervito-derivados
PROCESADOR_LAMBDA_A_LA_VEZ=<lo que sugiere el script>
```

y `pm2 restart cuervito`. `PROCESADOR_A_LA_VEZ` puede quedar en 8: las
vistas previas esperan su turno de Lambda sin usar el procesador, y el
reconocimiento, que sigue en el VPS, usa el resto.

## Probar sin AWS

```bash
npm install
npm run probar
```

Arma el paquete y lo prueba con una foto sintética de 24 MP: medidas, formato,
que el handler empaquetado dé los mismos bytes que el núcleo compartido, que una
foto angosta vuelva como `angosta` y una imagen rota como `imagen`. Corre con el
sharp de tu máquina, no con el de Linux: el de Linux lo prueba `desplegar.sh` al
final, invocando la función ya desplegada.
