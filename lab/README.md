# Laboratorio de front end

HTML y CSS plano, sin build. Se abre haciendo doble click en el archivo o
sirviendo la carpeta. Es para **decidir mirando**, no para producción: nada de
acá se despliega hasta que la dirección esté cerrada y lo bajemos a componentes
dentro de `cuervito/`.

```
lab/
  tokens.css          ← variables: color, tipografía, espaciado. Sin componentes
  base.css            ← componentes compartidos: botones, logotipo, h1/h2/h3
  panel.css           ← armazón del panel: riel, barra, tarjeta, fila, chips
  panel.js            ← inyecta riel y barra, engancha tema y cajón
  vendor/lucide.min.js  ← Lucide local, para que los íconos anden sin internet
  landing/  login/  alta/  recuperar/   ← público, sin riel: no cargan
                                          panel.css ni panel.js
  recuperar/  ← index (pedir el link) y nueva.html (poner la contraseña).
                Cargan login/login.css: son variaciones del ingreso, no
                pantallas nuevas. Los estados se miran con ?enviado,
                ?vencido y ?listo.
  dashboard/  eventos/  nuevo/  ventas/  fotos/  pagina/   ← panel
  cobros/  perfil/  ayuda/                                 ← panel, cuenta
```

Todas las páginas del panel son **hermanas**, un solo nivel de profundidad.
`nuevo/` no cuelga de `eventos/` justamente por eso: el riel enlaza con `../`,
y desde dos niveles adentro esos enlaces apuntarían a cualquier lado.

**Dónde se muestra la comisión:** sólo en `cobros/`. En Ventas el fotógrafo
mira cómo le está yendo, y meterle ahí la resta de la plataforma convierte una
buena noticia en una mala. A Cobros, en cambio, entra para entender cómo cobra:
ahí el desglose es lo que vino a buscar.

**El orden de carga no es opcional:** `tokens.css` → `base.css` → `panel.css` →
`<pagina>.css`. Una página sin `base.css` se queda sin botones; una del panel
sin `panel.css`, sin riel.

El menú del panel **no está en el HTML de cada pantalla**, lo inyecta
`panel.js`. Son cinco pantallas: con el marcado copiado en cada una, agregar un
ítem obliga a tocar cinco archivos y la que te olvidás queda desincronizada sin
que nadie lo note. Para sumar una entrada se edita el arreglo `NAV`.

Ojo con el orden de los scripts: `lucide.min.js` y `panel.js` van con `defer`,
así que un `<script>` suelto al final del `<body>` corre **antes** que ellos.
Por eso cada página llama a `Panel.init()` dentro de `DOMContentLoaded`.

**Después de tocar cualquier `.css`, correr `python sellar.py`.** Le pone
`?v=<ahora>` a todo el CSS y JS local. El navegador cachea por URL: una página
que pida `tokens.css` pelado se come una copia vieja y se siguen viendo
decisiones ya revertidas. Pasó dos veces con la tipografía, y lo peor es que el
archivo en disco está bien todo el tiempo, así que se busca el problema donde no
está.

Para verlo con las fuentes cargando bien:

```bash
cd lab && python -m http.server 8080   # después: http://localhost:8080/landing/
```

Desde el teléfono, con la IP de la máquina en la misma red, y **sin caché**, que
si no se ven versiones viejas del CSS:

```bash
cd lab && python -c "import http.server as h,functools; h.test(HandlerClass=functools.partial(h.SimpleHTTPRequestHandler), port=8080, bind='0.0.0.0')"
```

---

## La dirección, y por qué

**Base Whoop, no Wise.** Whoop se corre y deja mandar al contenido; Wise se
apodera de la pantalla. Como nuestra promesa es "tu marca adelante, tu dominio",
una identidad dominante pelearía contra el propio producto. De Wise tomamos dos
cosas y sólo en marketing: la audacia de escala tipográfica y los objetos
recortados flotando.

**La restricción que manda sobre todas las demás:** todo lo que se muestra es la
fotografía de alguien. El diseño es un marco, no un cuadro. Por eso no hay
degradés de color, ni superficies saturadas, ni translucidez sobre imágenes, ni
ilustración.

**Dos ánimos.** El panel del fotógrafo es instrumento: oscuro, denso, preciso
(todo lo que él usa en su día —Lightroom, Capture One— es oscuro). El flujo de
compra del atleta es comercio: claro, espacioso, pocas decisiones. Por eso las
secciones de lectura larga de esta landing van en papel.

## Tokens

| | |
|---|---|
| Fondo | `#0F0D0B` negro **cálido**, no gris azulado |
| Papel | `#FAFAF7` para precio y preguntas |
| Acento | `#E8590C` naranja quemado |
| Profundidad | grano al 3,5% + un glow radial. Nada más |

El acento bajó medio tono respecto del `#F5820A` anterior: la diferencia entre
"startup entusiasta" y "herramienta profesional". Y el naranja es de los pocos
colores que **no reclama ningún club del fútbol argentino**, que importa cuando
el mismo fotógrafo cubre a Huracán y a Colón en la misma semana.

Los semánticos (verde, rojo, amarillo) **nunca son la marca**. Si el naranja se
contagia a los estados, nadie entiende qué significa un color.

## Tipografía

Una sola superfamilia, **IBM Plex**, en tres roles: Sans para interfaz y
titulares, Mono para etiquetas y datos, Condensed para números grandes. Es la
decisión más sobria posible y elimina el riesgo de que dos fuentes peleen.

Se fue Bricolage Grotesque: es una display con personalidad marcada, justo lo
contrario de sobrio.

El contraste principal del sistema es de **escala** y de **ancho**, no de
estilo. Por eso no hay ninguna serif. Y la condensada pesada para los números no
es decorativa: el producto se trata literalmente de números en camisetas y
dorsales, así que la tipografía del dorsal es un activo de marca.

## Movimiento

Poco, lento y en un solo eje. Un objeto que se desplaza 40px mientras el scroll
avanza 100 es elegante; uno que rota, escala y rebota es una publicidad de
gaseosa. Sobriedad no es ausencia de movimiento, es disciplina de movimiento.

El parallax usa **scroll-driven animations nativas de CSS**
(`animation-timeline: view()`): sin JavaScript, sin librerías, y donde no hay
soporte simplemente no se mueve. Todo respeta `prefers-reduced-motion`.

## Lo que falta

**Los objetos recortados.** El SVG de la cámara es un marcador de posición. Van
recortes fotográficos reales sobre fondo liso con sombra propia: cámara, pelota,
palo de hockey, zapatilla, dorsal, cronómetro. **Que los shootee Germán**, con
el mismo equipo con el que cubre los partidos: sale una fracción de lo que cobra
un estudio, queda material propio sin licencias, y hay una historia para contar.

**Las portadas y fotos reales.** Los recuadros de la tira y del evento demo son
marcadores. Y hay que probar cada pantalla con una foto de fútbol amateur a las
18 hs, a contraluz: los sistemas de diseño para fotografía se rompen ahí, no con
una foto de stock perfectamente iluminada.

**El teléfono persistente estilo Cash App** no está. Es un elemento que
sobrevive entre secciones con estados coreografiados por scroll, cuesta bastante
más que todo lo demás junto y necesita una versión mobile distinta. Se decide
aparte.

**Prueba social.** No hay testimonios y no los va a haber inventados. Cuando
Germán dé el suyo, con nombre, foto y evento, entra.

## Copy

Castellano rioplatense con voseo (subís, cobrás, buscá, encontrá). Nunca "tú" ni
"usted". **Sin guiones largos**: no se usan acá, se resuelve con coma o dos
puntos.

Los números son reales: 21 eventos, 16.337 fotos, el Duatlón con 2.162. Nada de
cifras inventadas — la grilla de eventos las desmiente scrolleando.

## Próximo

El panel del fotógrafo, reusando `tokens.css`: lista de eventos, detalle con
grilla de fotos, ventas y cobros.
