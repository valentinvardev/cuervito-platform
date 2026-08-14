#!/usr/bin/env python3
"""Le pone ?v=<ahora> a todo el CSS y JS local de cada página del laboratorio.

Por qué existe: el navegador cachea por URL. Si una página pide `tokens.css`
pelado, se puede comer una copia guardada hace semanas, con la tipografía o
los colores de una decisión que ya se revirtió. Eso ya pasó dos veces (se
seguía viendo Manrope después de haber pasado a Outfit) y cuesta un rato
largo descubrir que el CSS del disco estaba bien todo el tiempo.

Correr después de tocar cualquier .css:

    python sellar.py
"""
import glob
import re
import time

v = str(int(time.time()))

for p in sorted(glob.glob("*/index.html")):
    with open(p, encoding="utf-8") as f:
        s = f.read()
    antes = s
    s = re.sub(r'(href="[^"]+?\.css)(\?v=\d+)?"', r"\1?v=" + v + '"', s)
    s = re.sub(r'(src="[^"]*?vendor/[^"]+?\.js)(\?v=\d+)?"', r"\1?v=" + v + '"', s)
    if s != antes:
        with open(p, "w", encoding="utf-8") as f:
            f.write(s)
    print(p, "->", v)
