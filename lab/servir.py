#!/usr/bin/env python3
"""Servidor del laboratorio, con cabeceras de caché correctas.

Antes se servía todo con `no-store`, que era un parche por el episodio del CSS
viejo en caché. El problema es que obliga a rebajar TODO en cada navegación:
CSS, JS y fuentes. Con nueve pantallas enlazadas por el riel, eso se siente
lento y era buena parte de lo que se notaba al cambiar de página.

La solución correcta ya la tenemos: `sellar.py` le pone ?v=<ahora> a cada
recurso. Entonces:

  · HTML          → no-store. Tiene que llegar fresco, porque es el que trae
                    el ?v= nuevo. Si se cacheara, seguiría pidiendo el viejo.
  · CSS/JS/fuentes → caché largo. La URL cambia sola cuando cambia el archivo.

    python servir.py [puerto]
"""
import functools
import http.server
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    ESTATICO = (".css", ".js", ".woff2", ".woff", ".png", ".jpg", ".svg")

    def end_headers(self):
        ruta, _, consulta = self.path.partition("?")
        # Caché largo SÓLO si la URL trae versión. Un archivo sin ?v= no se
        # puede cachear para siempre: no hay forma de invalidarlo después, y
        # el navegador se queda con esa copia aunque el archivo cambie. Eso
        # ya pasó con panel.js, que sellar.py no estaba sellando.
        if ruta.endswith(self.ESTATICO) and consulta.startswith("v="):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, *a):
        pass   # sin ruido: interesa el navegador, no el registro


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
    print("laboratorio en http://localhost:%d/  (y en la IP de esta máquina)" % puerto)
    http.server.test(HandlerClass=functools.partial(Handler), port=puerto, bind="0.0.0.0")
