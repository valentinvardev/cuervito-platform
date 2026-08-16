#!/usr/bin/env python3
"""Convierte el logotipo JPG en una silueta PNG con transparencia.

El original es un JPG con fondo crema texturado. Un filtro CSS no puede sacar
ese fondo: `brightness(0)` lo pinta de negro y `invert()` lo pasa a oscuro,
pero el rectángulo sigue ahí. Sobre papel casi se disimula; sobre la tinta del
tema oscuro sería una mancha clara con forma de cuadro.

Lo que se genera acá es la SILUETA: el trazo del logo en blanco puro y todo lo
demás transparente. Después el CSS lo usa como máscara y le pone
`background: currentColor`, así el logotipo toma el color del texto que lo
rodea y funciona en los dos temas sin una sola regla por tema. Es la misma
técnica que ya usamos para el logotipo de Mercado Pago.

Se genera en blanco y no en negro por si algún día hace falta usarlo como
<img> suelto: sobre fondo oscuro se ve, y con `filter: invert(1)` sirve sobre
claro. Como máscara el color de origen es indistinto.

    python vendor/gen-logo.py "../logo encontrate.jpg"
"""
import sys
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parent.parent
ORIGEN = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ.parent / "logo encontrate.jpg"
DESTINO = RAIZ / "assets" / "logo.png"

# Umbral de tinta. El fondo crema ronda 235-245 de luminancia y el trazo está
# por debajo de 100, así que 150 cae cómodo en el medio: no come el
# antialiasing del borde ni se lleva la textura del papel.
UMBRAL = 150
# Ancho de la rampa de suavizado. Sin esto el borde queda dentado; con esto,
# los píxeles intermedios del antialiasing original se convierten en alfa
# intermedio y el trazo mantiene sus curvas limpias.
RAMPA = 60

img = Image.open(ORIGEN).convert("L")
w, h = img.size

# Alfa a partir de la oscuridad, con rampa suave.
def alfa(v):
    if v <= UMBRAL - RAMPA:
        return 255
    if v >= UMBRAL + RAMPA:
        return 0
    return int(255 * (UMBRAL + RAMPA - v) / (RAMPA * 2))

mascara = img.point(alfa)

silueta = Image.new("RGBA", (w, h), (255, 255, 255, 0))
silueta.putalpha(mascara)

# Recorte al contenido real. El pedido era sacar sobre todo arriba y abajo,
# pero se recorta por los cuatro lados con el mismo criterio: el recuadro se
# calcula sobre lo que tiene tinta, así que no queda aire de un lado y no del
# otro. Sin esto, el logo se dibujaría chico y flotando dentro de su caja.
caja = mascara.getbbox()
if caja is None:
    raise SystemExit("No se encontró trazo: revisar el umbral.")
silueta = silueta.crop(caja)

# Aire a la derecha, horneado en el PNG. Podría ponerse como padding en el CSS,
# pero la máscara se posiciona dentro de la caja de relleno y el logo quedaría
# escalado distinto; con el aire adentro de la imagen, la proporción declarada
# ya lo contempla y no hay dos números que mantener sincronizados.
#
# Se mide contra el ALTO y no contra el ancho: así el aire se ve igual de
# grande sin importar cuánto mida el logotipo, que es como lo lee el ojo.
MARGEN_DER = round(silueta.height * 0.34)
conAire = Image.new("RGBA", (silueta.width + MARGEN_DER, silueta.height), (255, 255, 255, 0))
conAire.paste(silueta, (0, 0))
silueta = conAire

DESTINO.parent.mkdir(parents=True, exist_ok=True)
silueta.save(DESTINO, optimize=True)

cw, ch = silueta.size
print("original :", w, "x", h)
print("recortado:", cw, "x", ch, " proporción", round(cw / ch, 3))
print("guardado :", DESTINO, "-", DESTINO.stat().st_size, "bytes")
