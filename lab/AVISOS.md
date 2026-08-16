# Necesita tu atención — referencia para producción

Qué entra en esa lista del inicio, con qué condición se calcula y en qué orden
se muestra.

## La regla

Un aviso entra sólo si cumple **las tres**:

1. **Es verdad.** Sale de un dato, no de una suposición.
2. **Se arregla en un click.** El enlace lleva al lugar exacto donde se resuelve.
3. **Ignorarlo cuesta plata o tiempo hoy.** Si no cambia nada esta semana, no va.

Lo que no cumple las tres no es un aviso, es una notificación, y va a otro lado
o a ningún lado.

## Los avisos

Ordenados por costo de ignorarlos. Ese es también el orden en que se muestran:
primero lo que impide cobrar, después lo que hace vender menos, al final lo
cosmético. Se muestran **máximo cuatro**; el resto queda para cuando se
resuelvan los de arriba.

| # | Aviso | Condición | Va a |
|---|---|---|---|
| 1 | No podés cobrar | `user.mpConnectedAt IS NULL` | `/dashboard/pagos` |
| 2 | *Nombre* no puede cobrar sus fotos | colaborador `ACCEPTED` con `mpConnectedAt IS NULL` y ≥1 foto en un evento tuyo publicado | evento › equipo |
| 3 | *Evento* sin portada | `isPublished = true AND coverUrl IS NULL` | evento › portada |
| 4 | *Evento* sigue en borrador | `isPublished = false AND count(photos) > 0 AND createdAt < now() - 3 días` | evento |
| 5 | *Evento* publicado sin fotos | `isPublished = true AND count(photos) = 0` | evento › fotos |
| 6 | Invitación sin responder | colaborador `PENDING` con `invitedAt < now() - 5 días` | evento › equipo |
| 7 | Te falta la foto de perfil | `user.image IS NULL` | `/dashboard/perfil` |
| 8 | Te falta la bio | `user.bio IS NULL OR bio = ''` | `/dashboard/perfil` |
| 9 | Dominio sin verificar | `customDomain.status = 'PENDING'` y `createdAt < now() - 1 día` | mi página › dominio |
| 10 | *N* personas se buscaron y no aparecieron | `count(FaceSearchLog WHERE eventId = ? AND matchCount = 0)` sobre el total de búsquedas del evento, por encima de un umbral | evento › fotos |

Los umbrales de días existen para que el aviso no aparezca mientras el
fotógrafo todavía está trabajando. Un evento creado hace diez minutos y sin
publicar no es un descuido, es un evento en curso.

## Lo que se descartó, y por qué

**Fotos sin reconocer.** Es el problema más grande que encontramos, 2.647 fotos,
pero **es una falla de procesamiento nuestra**: el fotógrafo no la causó y no
puede arreglarla apretando un botón. Ponerla acá es decirle "fallamos,
arreglalo vos". Va a reintento automático del lado del servidor, y sólo se
avisa si el reintento también falla, que ahí sí es una anomalía que amerita
que alguien mire.

**Evento sin precio.** No existe: `pricePerPhoto` siempre tiene valor.

**Conversión baja.** Es interesante pero no accionable en un click, y sin
comparación contra eventos parecidos es sólo un número que asusta.

**Nota sobre el aviso 10.** Es el más valioso de la tabla y hoy no se muestra
en ningún lado. Una búsqueda con `matchCount = 0` significa una de dos cosas, y
las dos importan: o la cobertura del evento fue floja en ese tramo de la
carrera, o el reconocimiento falló con esas fotos. Es la única señal que tenemos
de gente que quiso comprar y no pudo.

Necesita un umbral, porque siempre va a haber algunos: alguien que abandonó la
carrera, alguien que se buscó en el evento equivocado. Empezaría avisando
cuando pase del 15% de las búsquedas del evento.

**Cuota de almacenamiento.** Cuando falte poco hay que avisar, pero es un
mensaje de sistema, no una tarea del fotógrafo. Va en su propio lugar.

## La tasa de conversión, y de qué se divide

`compraron / se encontraron`, donde "se encontraron" son las búsquedas con
`matchCount > 0`.

No es sobre visitas y no es sobre búsquedas totales, por dos razones:

**Las visitas empeoran el número cuando pasa algo bueno.** Si el organizador
comparte el link en un grupo de 500 personas, entran cientos que no corrieron
esa carrera y la tasa se desploma el día de mayor difusión. Una métrica que baja
cuando las cosas mejoran no sirve para decidir.

**El que buscó y no apareció no podía comprar.** Contarlo como conversión
fallida culpa al fotógrafo por cobertura o por una falla de reconocimiento, no
por su vidriera.

Con `matchCount > 0` queda aislado lo único que el fotógrafo controla: la
persona se vio en las fotos y ahí decidió. Si no compró, es el precio, la
calidad, la marca de agua o el checkout.

Las visitas siguen siendo útiles, pero como medida de **difusión**, no de
conversión, y por eso van en la pantalla del evento y no acá.

## Cuando la lista queda vacía

Se dice y se celebra: *"No hay nada pendiente. Tus eventos están publicados, con
portada y cobrando."*

No es adorno. Una lista que nunca puede quedar limpia entrena a no mirarla, y a
partir de ahí los avisos que sí importan tampoco se leen.

## Estados vacíos del resto del inicio

Se pueden ver con `?vacio=1` en la dirección del panel.

| Bloque | Vacío | Por qué ese texto |
|---|---|---|
| Tus eventos | *No se encontraron eventos* + botón para crear | Crear el primero es la única acción posible, así que va con su botón y no como texto triste |
| Últimas ventas | *No se encontraron ventas* + repartir el link | Sin ventas la causa suele ser que nadie vio el evento. Repartir el link es lo que lo arregla, y es de donde vienen casi todas las primeras ventas |

En Últimas ventas el total del pie también se esconde: un "Total de hoy $0"
debajo de un vacío es ruido.
