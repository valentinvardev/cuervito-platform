#!/usr/bin/env python3
"""Genera los favicons a partir del isotipo en JPG.

Tres cosas que el archivo de origen obliga a resolver:

1. Fondo crema texturado, no transparente. Se separa por umbral de luminancia,
   igual que el logotipo horizontal.

2. La imagen trae el destello de marca de agua del generador abajo a la
   derecha. Recortar al contenido sin más lo mete adentro del recuadro y
   termina en el favicon como una basurita. Por eso no se usa el bbox de todo
   lo que tenga tinta: se busca la MANCHA MÁS GRANDE y se recorta a esa. El
   destello es diminuto comparado con el pájaro, así que queda afuera solo.

3. El isotipo es más alto que ancho y un favicon es cuadrado. Se centra en un
   lienzo cuadrado con aire, en vez de deformarlo.

Se generan dos juegos de color, no uno con filtro: el navegador dibuja la
pestaña con SU tema, no con el del sitio, y a un <link rel="icon"> no se le
puede aplicar CSS. La elección se hace con el atributo media del link.

    python vendor/gen-favicon.py "../Gemini_Generated_Image_....jpg"
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = Path(sys.argv[1])
SALIDA = RAIZ / "assets"

UMBRAL = 150
RAMPA = 60
# Aire alrededor, en proporción del lado. Un ícono que toca los bordes se ve
# apretado al lado de los demás de la barra de pestañas, que sí lo tienen.
AIRE = 0.10

TINTA = (18, 17, 15)
PAPEL = (250, 250, 248)
MEDIDAS = [16, 32, 48, 180, 192, 512]


def alfa(v):
    if v <= UMBRAL - RAMPA:
        return 255
    if v >= UMBRAL + RAMPA:
        return 0
    return int(255 * (UMBRAL + RAMPA - v) / (RAMPA * 2))


gris = Image.open(ORIGEN).convert("L")
mascara = gris.point(alfa)
W, H = mascara.size

# ── Mancha más grande ──────────────────────────────────────────────────────
# El etiquetado corre sobre una copia reducida: a tamaño completo son millones
# de píxeles y en Python puro tarda una eternidad, mientras que para decidir
# "cuál es la mancha grande" no hace falta ninguna precisión.
ESCALA = 400 / max(W, H)
chico = mascara.resize((max(1, int(W * ESCALA)), max(1, int(H * ESCALA))))
cw, ch = chico.size
px = chico.load()

visto = [[False] * ch for _ in range(cw)]
mejor = None
for x0 in range(cw):
    for y0 in range(ch):
        if visto[x0][y0] or px[x0, y0] < 128:
            continue
        cola = deque([(x0, y0)])
        visto[x0][y0] = True
        pts = []
        while cola:
            x, y = cola.popleft()
            pts.append((x, y))
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                nx, ny = x + dx, y + dy
                if 0 <= nx < cw and 0 <= ny < ch and not visto[nx][ny] and px[nx, ny] >= 128:
                    visto[nx][ny] = True
                    cola.append((nx, ny))
        if mejor is None or len(pts) > len(mejor):
            mejor = pts

if not mejor:
    raise SystemExit("No se encontró ninguna mancha: revisar el umbral.")

xs = [p[0] for p in mejor]
ys = [p[1] for p in mejor]
caja = (
    max(0, int(min(xs) / ESCALA) - 2),
    max(0, int(min(ys) / ESCALA) - 2),
    min(W, int((max(xs) + 1) / ESCALA) + 2),
    min(H, int((max(ys) + 1) / ESCALA) + 2),
)
mascara = mascara.crop(caja)
mw, mh = mascara.size

# ── Lienzo cuadrado con aire ───────────────────────────────────────────────
lado = int(max(mw, mh) * (1 + AIRE * 2))
cuadrado = Image.new("L", (lado, lado), 0)
cuadrado.paste(mascara, ((lado - mw) // 2, (lado - mh) // 2))

SALIDA.mkdir(parents=True, exist_ok=True)


def guardar(color, nombre):
    for medida in MEDIDAS:
        m = cuadrado.resize((medida, medida), Image.LANCZOS)
        icono = Image.new("RGBA", (medida, medida), color + (0,))
        icono.putalpha(m)
        icono.save(SALIDA / f"{nombre}-{medida}.png", optimize=True)
    # El .ico lleva los tamaños chicos, que es lo que pide la pestaña.
    base = Image.new("RGBA", (512, 512), color + (0,))
    base.putalpha(cuadrado.resize((512, 512), Image.LANCZOS))
    base.save(SALIDA / f"{nombre}.ico", sizes=[(16, 16), (32, 32), (48, 48)])


guardar(TINTA, "icono-tinta")
guardar(PAPEL, "icono-papel")

# iOS no respeta la transparencia del ícono de inicio: lo compone sobre negro.
# Por eso este va con fondo opaco de papel, y no transparente como los demás.
tapa = Image.new("RGBA", (180, 180), PAPEL + (255,))
tinta = Image.new("RGBA", (180, 180), TINTA + (255,))
tinta.putalpha(cuadrado.resize((180, 180), Image.LANCZOS))
tapa.alpha_composite(tinta)
tapa.convert("RGB").save(SALIDA / "apple-touch.png", optimize=True)

print("origen   :", W, "x", H)
print("recorte  :", mw, "x", mh, "(mancha más grande, sin el destello)")
print("lienzo   :", lado, "x", lado, "con", int(AIRE * 100), "% de aire")
print("generados:", len(MEDIDAS) * 2, "PNG y 2 ICO en", SALIDA)
