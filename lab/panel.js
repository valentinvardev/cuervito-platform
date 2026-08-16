/* =============================================================================
   encontrate · armazón del panel
   -----------------------------------------------------------------------------
   Inyecta el riel y la barra superior, y engancha tema, cajón y iconos. Son
   cinco pantallas: con el HTML del menú copiado en cada una, agregar un ítem
   obliga a tocar cinco archivos y la que te olvidás queda desincronizada sin
   que nadie lo note.

   Uso, al final del <body> de cada página:

       <script src="../panel.js"></script>
       <script>Panel.init({ activo: "eventos", titulo: "..." });</script>
   ========================================================================== */
(function () {
  "use strict";

  /* Fotos no está acá a propósito. Un fotógrafo de eventos no piensa en "mis
     fotos", piensa en "las del Duatlón": las fotos viven dentro de un evento.
     Como destino de primer nivel competía con Eventos sin ganarle en nada, y
     encima su contador en rojo era ambiguo, se leía como "tenés 2.064 fotos".

     La biblioteca sigue existiendo en ../fotos/, pero como destino de TAREA:
     se llega desde la tarjeta de atención del inicio, que es cuando de verdad
     hace falta cruzar todos los eventos. */
  var NAV = [
    { id: "inicio",  href: "../dashboard/", icono: "layout-grid",   texto: "Inicio" },
    { id: "eventos", href: "../eventos/",   icono: "calendar-days", texto: "Eventos", n: "6" },
    { id: "ventas",  href: "../ventas/",    icono: "receipt-text",  texto: "Ventas",  n: "214" },
    { id: "pagina",  href: "../pagina/",    icono: "store",         texto: "Mi página" }
  ];

  var CUENTA = [
    { id: "pagos",  href: "../pagos/",  icono: "wallet",     texto: "Métodos de pago" },
    { id: "perfil", href: "../perfil/", icono: "user-round", texto: "Perfil" },
    { id: "ayuda",  href: "../ayuda/",  icono: "life-buoy",  texto: "Ayuda" }
  ];
  // Se anuncian antes de existir para que se vea hacia dónde va esto. No
  // llevan a ningún lado a propósito: un ítem que se ve igual que los demás
  // y no hace nada se prueba una vez, no pasa nada, y se prueba de nuevo.
  var PRONTO = [
    { id: "portfolio", icono: "images",   texto: "Portfolio" },
    { id: "studio",    icono: "sparkles", texto: "Historias" }
  ];

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  function item(it, activo) {
    var aqui = it.id === activo;
    return '<a href="' + esc(it.href) + '" class="rl"' + (aqui ? ' aria-current="page"' : "") + ">" +
      '<i data-lucide="' + esc(it.icono) + '"></i> ' + esc(it.texto) +
      (it.n ? '<span class="rl-n' + (it.hot ? " hot" : "") + '">' + esc(it.n) + "</span>" : "") +
      "</a>";
  }

  function riel(activo) {
    return '<aside class="rail" id="rail">' +
      '<div class="rail-top"><a href="../landing/" class="mark">encontrate<i></i>app</a></div>' +
      '<nav class="rail-nav">' + NAV.map(function (i) { return item(i, activo); }).join("") + "</nav>" +
      '<div><div class="rail-sep"></div><div class="rail-cap">Cuenta</div>' +
      '<nav class="rail-nav">' + CUENTA.map(function (i) { return item(i, activo); }).join("") + "</nav></div>" +
      '<div><div class="rail-sep"></div><div class="rail-cap">Próximamente</div>' +
      '<div class="rail-nav">' + PRONTO.map(function (i) {
        return '<span class="rl pronto" aria-disabled="true"><i data-lucide="' + i.icono + '"></i> ' +
          esc(i.texto) + '<span class="rl-pronto">Pronto</span></span>';
      }).join("") + "</div></div>" +
      '<div class="rail-bot">' +
      '<a href="https://wa.me/5492284000000" target="_blank" rel="noopener" class="rail-wa">' +
      '<svg class="wa" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.65-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.87 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z"/>' +
      '<path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.86 9.86 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.25-8.23a8.19 8.19 0 0 1 8.24 8.24c0 4.54-3.7 8.23-8.24 8.23Z"/>' +
      '</svg> Escribinos</a>' +
      '<a href="#" class="me">' +
      '<span class="me-av">GS</span>' +
      '<span class="me-txt"><b>Germán Sosa</b><span>encontrate.app/german</span></span>' +
      "</a></div></aside>";
  }

  function barra(o) {
    return '<header class="top">' +
      '<button class="btn btn-ghost btn-icon burger-d" id="burger" aria-label="Abrir menú" aria-expanded="false">' +
      '<span class="ico ico-menu"><i data-lucide="menu"></i></span>' +
      '<span class="ico ico-close"><i data-lucide="x"></i></span>' +
      "</button>" +
      '<button class="btn btn-ghost btn-icon buscar-movil" id="buscar-movil" aria-label="Buscar">' +
      '<i data-lucide="search"></i></button>' +
      '<div class="search" id="search">' +
      '<i data-lucide="search" class="lupa"></i>' +
      '<input type="search" id="q" autocomplete="off" placeholder="' +
      esc(o.buscar || "Buscar evento, dorsal o venta") + '">' +
      '<kbd id="atajo">K</kbd>' +
      '<div class="sr" id="sr" role="listbox"></div>' +
      "</div>" +
      '<div class="top-r">' +
      '<button class="btn btn-ghost btn-icon js-tema" aria-label="Cambiar tema">' +
      '<span class="ico ico-moon"><i data-lucide="moon"></i></span>' +
      '<span class="ico ico-sun"><i data-lucide="sun"></i></span>' +
      "</button>" +
      '<a href="../nuevo/" class="btn btn-pri"><i data-lucide="plus"></i> Nuevo evento</a>' +
      "</div></header>";
  }

  /* ── Desplegables ───────────────────────────────────────────────────────────
     Reemplazan al <select>, del que sólo se puede estilar la caja cerrada. Lo
     que hay que reponer a mano es todo lo que el nativo daba gratis: teclado,
     click afuera, Escape y roles. Si esto no estuviera, el desplegable sería
     bonito e inusable con el teclado. ───────────────────────────────────── */
  function desplegables(raiz) {
    var abierto = null;

    function cerrar() {
      if (!abierto) return;
      abierto.dataset.abierto = "";
      abierto.querySelector(".dd-t").setAttribute("aria-expanded", "false");
      abierto.querySelectorAll(".dd-o").forEach(function (o) { o.classList.remove("marcado"); });
      abierto = null;
    }

    function abrir(dd) {
      if (abierto && abierto !== dd) cerrar();
      dd.dataset.abierto = "1";
      dd.querySelector(".dd-t").setAttribute("aria-expanded", "true");
      abierto = dd;
    }

    (raiz || document).querySelectorAll(".dd").forEach(function (dd) {
      var disp = dd.querySelector(".dd-t");
      var val = dd.querySelector(".dd-v");
      var opciones = Array.prototype.slice.call(dd.querySelectorAll(".dd-o"));

      disp.setAttribute("aria-haspopup", "listbox");
      disp.setAttribute("aria-expanded", "false");

      disp.addEventListener("click", function (e) {
        e.stopPropagation();
        if (dd.dataset.abierto === "1") { cerrar(); } else { abrir(dd); }
      });

      opciones.forEach(function (o) {
        o.setAttribute("role", "option");
        o.addEventListener("click", function (e) {
          e.stopPropagation();
          opciones.forEach(function (x) { x.setAttribute("aria-selected", "false"); });
          o.setAttribute("aria-selected", "true");
          if (val) val.textContent = o.dataset.v || o.textContent.trim();
          cerrar();
          disp.focus();
          dd.dispatchEvent(new CustomEvent("elegir", {
            bubbles: true,
            detail: { valor: o.dataset.k || o.textContent.trim() }
          }));
        });
      });

      /* Teclado. Flechas mueven la marca, Enter elige, Escape cierra sin
         cambiar nada, que es lo que espera cualquiera que use un select. */
      dd.addEventListener("keydown", function (e) {
        var vivas = opciones.filter(function (o) { return !o.hidden; });
        if (!vivas.length) return;
        var i = vivas.findIndex(function (o) { return o.classList.contains("marcado"); });

        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (dd.dataset.abierto !== "1") { abrir(dd); }
          i = e.key === "ArrowDown"
            ? (i < 0 ? 0 : Math.min(vivas.length - 1, i + 1))
            : (i < 0 ? vivas.length - 1 : Math.max(0, i - 1));
          vivas.forEach(function (o) { o.classList.remove("marcado"); });
          vivas[i].classList.add("marcado");
          vivas[i].scrollIntoView({ block: "nearest" });
        } else if (e.key === "Enter" || e.key === " ") {
          if (dd.dataset.abierto === "1" && i >= 0) { e.preventDefault(); vivas[i].click(); }
        } else if (e.key === "Escape") {
          cerrar(); disp.focus();
        }
      });
    });

    document.addEventListener("click", cerrar);
  }

  /* ── Calendario ─────────────────────────────────────────────────────────────
     Reemplaza a <input type="date">, que lo dibuja el sistema operativo y
     encima muestra el formato según la configuración de quien abre la página:
     el mismo campo puede decir 14/08/2026 o 08/14/2026, y en un producto
     argentino eso es una fuente real de errores de carga.

     Arranca la semana en lunes. ──────────────────────────────────────────── */
  var MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
               "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  var DIAS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

  function iso(d) {
    return d.getFullYear() + "-" +
      String(d.getMonth() + 1).padStart(2, "0") + "-" +
      String(d.getDate()).padStart(2, "0");
  }
  function mismoDia(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }
  function largo(d) {
    return d.getDate() + " de " + MESES[d.getMonth()] +
      (d.getFullYear() !== new Date().getFullYear() ? " de " + d.getFullYear() : "");
  }

  function calendarios(raiz) {
    var abierto = null;

    function cerrar() {
      if (!abierto) return;
      abierto.dataset.abierto = "";
      abierto.querySelector(".fx-t").setAttribute("aria-expanded", "false");
      abierto = null;
    }

    (raiz || document).querySelectorAll(".fx").forEach(function (fx) {
      var disp = fx.querySelector(".fx-t");
      var val = fx.querySelector(".fx-v");
      var oculto = fx.querySelector("input[type=hidden]");
      var menu = fx.querySelector(".fx-m");

      var hoy = new Date();
      var elegido = oculto && oculto.value ? new Date(oculto.value + "T12:00:00") : null;
      var vista = new Date(elegido || hoy);
      vista.setDate(1);

      function pintar() {
        // getDay() da 0 para domingo; acá la semana empieza el lunes.
        var primero = new Date(vista.getFullYear(), vista.getMonth(), 1);
        var corr = (primero.getDay() + 6) % 7;
        var inicio = new Date(primero);
        inicio.setDate(1 - corr);

        var celdas = "";
        for (var i = 0; i < 42; i++) {
          var d = new Date(inicio);
          d.setDate(inicio.getDate() + i);
          var fuera = d.getMonth() !== vista.getMonth();
          celdas += '<button type="button" class="fx-d' +
            (fuera ? " fuera" : "") + (mismoDia(d, hoy) ? " hoy" : "") + '"' +
            (mismoDia(d, elegido) ? ' aria-selected="true"' : "") +
            ' data-d="' + iso(d) + '">' + d.getDate() + "</button>";
        }

        menu.innerHTML =
          '<div class="fx-nav">' +
            '<button type="button" data-mes="-1" aria-label="Mes anterior"><i data-lucide="chevron-left"></i></button>' +
            "<b>" + MESES[vista.getMonth()] + " " + vista.getFullYear() + "</b>" +
            '<button type="button" data-mes="1" aria-label="Mes siguiente"><i data-lucide="chevron-right"></i></button>' +
          "</div>" +
          '<div class="fx-sem">' + DIAS.map(function (x) { return "<span>" + x + "</span>"; }).join("") + "</div>" +
          '<div class="fx-grid">' + celdas + "</div>" +
          '<div class="fx-pie"><button type="button" data-hoy="1">Hoy</button>' +
          '<button type="button" data-limpiar="1">Borrar</button></div>';
        try { lucide.createIcons(menu); } catch (e) {}
      }

      function mostrar() {
        if (elegido) {
          val.textContent = largo(elegido);
          val.classList.remove("vacio");
          fx.dataset.hay = "1";
          if (oculto) oculto.value = iso(elegido);
        } else {
          val.textContent = disp.dataset.vacio || "Elegí la fecha";
          val.classList.add("vacio");
          fx.dataset.hay = "";
          if (oculto) oculto.value = "";
        }
        fx.dispatchEvent(new CustomEvent("fecha", { bubbles: true, detail: { valor: elegido } }));
      }

      disp.setAttribute("aria-expanded", "false");
      disp.addEventListener("click", function (e) {
        e.stopPropagation();
        if (fx.dataset.abierto === "1") { cerrar(); return; }
        if (abierto) cerrar();
        vista = new Date(elegido || hoy); vista.setDate(1);
        pintar();
        fx.dataset.abierto = "1";
        disp.setAttribute("aria-expanded", "true");
        abierto = fx;
      });

      menu.addEventListener("click", function (e) {
        e.stopPropagation();
        var b = e.target.closest("button");
        if (!b) return;
        if (b.dataset.mes) {
          vista.setMonth(vista.getMonth() + parseInt(b.dataset.mes, 10));
          pintar();
        } else if (b.dataset.hoy) {
          elegido = new Date(); mostrar(); cerrar();
        } else if (b.dataset.limpiar) {
          elegido = null; mostrar(); cerrar();
        } else if (b.dataset.d) {
          elegido = new Date(b.dataset.d + "T12:00:00"); mostrar(); cerrar();
        }
      });

      fx.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { cerrar(); disp.focus(); }
      });

      mostrar();
    });

    document.addEventListener("click", cerrar);
  }

  /* ── Importes ───────────────────────────────────────────────────────────────
     Formatea con puntos de mil mientras se escribe. El cuidado está en el
     cursor: si uno se limita a reescribir el value, el cursor salta al final y
     corregir un dígito del medio se vuelve imposible. Por eso se cuentan los
     dígitos que había antes del cursor y se lo repone en esa misma posición
     lógica, ya con los puntos puestos. ──────────────────────────────────── */
  function importes(raiz) {
    (raiz || document).querySelectorAll("input[data-plata]").forEach(function (inp) {
      function formatear() {
        var antes = inp.value.slice(0, inp.selectionStart || 0).replace(/\D/g, "").length;
        var digitos = inp.value.replace(/\D/g, "").slice(0, 9);
        inp.value = digitos ? parseInt(digitos, 10).toLocaleString("es-AR") : "";
        var pos = 0, vistos = 0;
        while (pos < inp.value.length && vistos < antes) {
          if (/\d/.test(inp.value[pos])) vistos++;
          pos++;
        }
        try { inp.setSelectionRange(pos, pos); } catch (e) {}
        inp.dispatchEvent(new CustomEvent("plata", {
          bubbles: true,
          detail: { valor: digitos ? parseInt(digitos, 10) : 0 }
        }));
      }
      inp.addEventListener("input", formatear);
      inp.setAttribute("inputmode", "numeric");
      if (inp.value) formatear();
    });
  }


  /* ── Buscador ───────────────────────────────────────────────────────────────
     Vive acá y no en cada pantalla porque la barra la inyecta este archivo:
     con el buscador en cada página habría nueve copias del mismo índice,
     listas para quedar desactualizadas de a una.

     El índice es fijo en el laboratorio. En el producto sale de una consulta
     al servidor con debounce; la interfaz no cambia. ─────────────────────── */
  var INDICE = {
    eventos: [
      { n: "Duatlón Club Ciclista Chivilcoy", m: "Hoy · Chivilcoy · 2.162 fotos", h: "../evento/" },
      { n: "Media Maratón de Chivilcoy",      m: "3 de agosto · 3.104 fotos",     h: "../evento/" },
      { n: "Torneo Apertura · Fecha 8",       m: "27 de julio · 1.488 fotos",     h: "../evento/" },
      { n: "Copa Ciudad · Hockey",            m: "19 de julio · Bragado",         h: "../evento/" },
      { n: "Maratón Río Cuarto",              m: "Sin publicar · 946 fotos",      h: "../evento/" },
      { n: "Triatlón de Necochea",            m: "Sin publicar · 1.204 fotos",    h: "../evento/" }
    ],
    ventas: [
      { n: "Martina Fernández", m: "Duatlón · 4 fotos · $7.200",   h: "../ventas/" },
      { n: "Juan Pablo Ríos",   m: "Duatlón · 2 fotos · $3.600",   h: "../ventas/" },
      { n: "Lucía Cabrera",     m: "Duatlón · 9 fotos · $14.400",  h: "../ventas/" },
      { n: "Emiliano Duarte",   m: "Media Maratón · 3 fotos",      h: "../ventas/" },
      { n: "Matías Bustos",     m: "Duatlón · 12 fotos · $19.200", h: "../ventas/" }
    ],
    gente: [
      { n: "Matías Peralta", m: "Colabora en Duatlón Chivilcoy", h: "../evento/" },
      { n: "Rocío Leiva",    m: "Invitada al Duatlón",           h: "../evento/" }
    ]
  };

  var GRUPOS = [
    { k: "eventos", tit: "Eventos", icono: "calendar-days", cv: true },
    { k: "ventas",  tit: "Ventas",  icono: "receipt-text" },
    { k: "gente",   tit: "Equipo",  icono: "user-round" }
  ];

  // Sin acentos y en minúscula: buscar "duatlon" tiene que encontrar "Duatlón".
  // Quien escribe rápido no pone tildes, y es justamente el que más usa esto.
  function plano(t) {
    return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function resaltar(texto, q) {
    var i = plano(texto).indexOf(plano(q));
    if (i < 0) return esc(texto);
    return esc(texto.slice(0, i)) + "<mark>" + esc(texto.slice(i, i + q.length)) +
      "</mark>" + esc(texto.slice(i + q.length));
  }

  function buscador() {
    var caja = document.getElementById("search");
    var campo = document.getElementById("q");
    var panel = document.getElementById("sr");
    if (!caja || !campo || !panel) return;

    var raiz = document.documentElement;
    var items = [];
    var marcado = -1;

    // El atajo se rotula según el sistema: en Mac es Cmd y en el resto Ctrl.
    // Mostrar el símbolo equivocado es peor que no mostrar ninguno.
    var esMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    document.getElementById("atajo").textContent = (esMac ? "⌘" : "Ctrl ") + "K";

    function abrir(v) {
      caja.dataset.abierto = v ? "1" : "";
      if (!v) { marcado = -1; raiz.dataset.buscar = ""; }
    }

    function pintar() {
      var q = campo.value.trim();
      items = [];
      var html = "";

      // Todo dígitos: el atajo al dorsal va primero. Es la búsqueda más
      // frecuente del día del evento y la que más rápido tiene que salir.
      if (/^\d+$/.test(q)) {
        items.push({ h: "../evento/#dorsal-" + q });
        html += '<div class="sr-tit">Dorsal</div>' +
          '<div class="sr-item" data-i="0">' +
          '<span class="sr-i"><i data-lucide="hash"></i></span>' +
          '<span class="sr-t"><b>Ver las fotos con el dorsal ' + esc(q) + "</b>" +
          "<span>En Duatlón Club Ciclista Chivilcoy</span></span>" +
          '<span class="sr-tec">Enter</span></div>';
      }

      if (q) {
        GRUPOS.forEach(function (g) {
          var hall = INDICE[g.k].filter(function (x) {
            return plano(x.n).indexOf(plano(q)) >= 0 || plano(x.m).indexOf(plano(q)) >= 0;
          }).slice(0, 4);
          if (!hall.length) return;
          html += '<div class="sr-tit">' + g.tit + "</div>";
          hall.forEach(function (x) {
            var i = items.length;
            items.push(x);
            html += '<div class="sr-item" data-i="' + i + '">' +
              (g.cv ? '<span class="sr-cv"></span>'
                    : '<span class="sr-i"><i data-lucide="' + g.icono + '"></i></span>') +
              '<span class="sr-t"><b>' + resaltar(x.n, q) + "</b><span>" + esc(x.m) + "</span></span>" +
              '<span class="sr-tec">Enter</span></div>';
          });
        });
      }

      if (!q) {
        // Sin texto no se muestra una lista vacía: se muestra qué se puede
        // buscar. Es el único momento en que el usuario mira sin apuro.
        html = '<div class="sr-tit">Buscá por</div>' +
          '<div class="sr-item" data-i="0"><span class="sr-i"><i data-lucide="hash"></i></span>' +
          '<span class="sr-t"><b>Un dorsal</b><span>Escribí el número y listo</span></span></div>' +
          '<div class="sr-item" data-i="1"><span class="sr-i"><i data-lucide="calendar-days"></i></span>' +
          '<span class="sr-t"><b>Un evento</b><span>Por nombre o por lugar</span></span></div>' +
          '<div class="sr-item" data-i="2"><span class="sr-i"><i data-lucide="receipt-text"></i></span>' +
          '<span class="sr-t"><b>Una venta</b><span>Por comprador o por mail</span></span></div>';
        items = [{ h: "" }, { h: "../eventos/" }, { h: "../ventas/" }];
      } else if (!items.length) {
        html = '<div class="sr-nada"><b>Nada con “' + esc(q) + '”</b>' +
          "<span>Probá con el nombre del evento, un dorsal o el comprador.</span></div>";
      }

      panel.innerHTML = html;
      marcado = items.length ? 0 : -1;
      marcar();
      try { lucide.createIcons(panel); } catch (e) {}
    }

    function marcar() {
      panel.querySelectorAll(".sr-item").forEach(function (el, i) {
        el.classList.toggle("marcado", i === marcado);
        if (i === marcado) el.scrollIntoView({ block: "nearest" });
      });
    }

    function ir(i) {
      var x = items[i];
      if (x && x.h) window.location.href = x.h;
    }

    campo.addEventListener("focus", function () { abrir(true); pintar(); });
    campo.addEventListener("input", pintar);

    campo.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!items.length) return;
        marcado = e.key === "ArrowDown"
          ? (marcado + 1) % items.length
          : (marcado - 1 + items.length) % items.length;
        marcar();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (marcado >= 0) ir(marcado);
      } else if (e.key === "Escape") {
        if (campo.value) { campo.value = ""; pintar(); }
        else { abrir(false); campo.blur(); }
      }
    });

    panel.addEventListener("mousemove", function (e) {
      var it = e.target.closest(".sr-item");
      if (it && +it.dataset.i !== marcado) { marcado = +it.dataset.i; marcar(); }
    });
    panel.addEventListener("click", function (e) {
      var it = e.target.closest(".sr-item");
      if (it) ir(+it.dataset.i);
    });

    document.addEventListener("click", function (e) {
      if (!caja.contains(e.target)) abrir(false);
    });

    // Atajo de teclado. Se ignora si el foco ya está en un campo: robarle
    // Ctrl+K a alguien que está escribiendo el nombre de un evento es peor
    // que no tener atajo.
    document.addEventListener("keydown", function (e) {
      if (!(e.key === "k" || e.key === "K") || !(e.metaKey || e.ctrlKey)) return;
      var t = document.activeElement;
      if (t && /INPUT|TEXTAREA/.test(t.tagName) && t !== campo) return;
      e.preventDefault();
      raiz.dataset.buscar = "open";
      campo.focus();
      campo.select();
    });

    var movil = document.getElementById("buscar-movil");
    if (movil) {
      movil.addEventListener("click", function () {
        raiz.dataset.buscar = "open";
        setTimeout(function () { campo.focus(); }, 60);
      });
    }
  }


  /* ── Números que suben ──────────────────────────────────────────────────────
     El valor final ya está escrito en el HTML: si el JS no corre, el número
     está igual. La animación sólo lo reemplaza durante un segundo, nunca lo
     produce. Un contador que arranca en "0" escrito a mano deja la pantalla
     mostrando cero cuando algo falla.

     Sale del final hacia atrás con easing de salida: arranca rápido y frena.
     Un contador lineal se ve como una máquina; uno que desacelera se lee como
     un número aterrizando. ────────────────────────────────────────────────── */
  function numeros(raiz) {
    var quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var nodos = (raiz || document).querySelectorAll("[data-num]");

    nodos.forEach(function (el, i) {
      var fin = parseFloat(el.dataset.num);
      if (isNaN(fin) || quieto) return;
      var dec = parseInt(el.dataset.dec || "0", 10);
      var pre = el.dataset.pre || "";
      var dur = 1000;
      var arranco = false;

      function formato(v) {
        return pre + v.toLocaleString("es-AR", {
          minimumFractionDigits: dec,
          maximumFractionDigits: dec
        });
      }

      function correr() {
        if (arranco) return;
        arranco = true;

        // El origen se toma del PRIMER cuadro, no de performance.now(). Son
        // dos relojes distintos y mezclarlos tiene una consecuencia concreta:
        // si la pestaña pasa a segundo plano, requestAnimationFrame se detiene
        // pero performance.now() sigue corriendo, así que al volver el número
        // aparecería ya terminado en vez de animarse.
        var t0 = null;
        // Escalonado: los tres indicadores arrancando en el mismo cuadro se
        // leen como un solo bloque parpadeando.
        var retardo = i * 90;

        function paso(t) {
          if (t0 === null) t0 = t;
          var p = (t - t0 - retardo) / dur;
          if (p < 0) { requestAnimationFrame(paso); return; }
          p = Math.min(1, p);
          var e = 1 - Math.pow(1 - p, 3);   // ease-out cúbico: arranca rápido y frena
          el.textContent = formato(fin * e);
          if (p < 1) requestAnimationFrame(paso);
          else el.textContent = formato(fin);
        }

        el.textContent = formato(0);
        requestAnimationFrame(paso);
      }

      // Sólo cuando entra en pantalla: animar algo que el usuario no está
      // mirando gasta la animación y llega tarde al scroll.
      if (!("IntersectionObserver" in window)) { correr(); return; }
      var obs = new IntersectionObserver(function (ent) {
        if (ent[0].isIntersecting) { correr(); obs.disconnect(); }
      }, { threshold: 0.4 });
      obs.observe(el);
    });
  }

  function init(o) {
    o = o || {};
    var app = document.querySelector(".app");
    if (!app) return;

    // El riel va antes de la columna de contenido, que ya está en el HTML.
    app.insertAdjacentHTML("afterbegin", riel(o.activo));
    var col = app.querySelector(".col");
    if (col) col.insertAdjacentHTML("afterbegin", barra(o));
    document.body.insertAdjacentHTML("beforeend", '<div class="rail-scrim" id="rail-scrim"></div>');

    try { lucide.createIcons(); } catch (e) { console.warn("lucide:", e); }

    /* Tema. Cada bloque va aislado: si uno falla, los otros siguen. */
    try {
      var raiz = document.documentElement;
      document.querySelectorAll(".js-tema").forEach(function (b) {
        b.addEventListener("click", function () {
          var osc = raiz.dataset.theme === "dark";
          raiz.dataset.theme = osc ? "" : "dark";
          try { localStorage.setItem("tema", osc ? "light" : "dark"); } catch (e) {}
        });
      });
    } catch (e) { console.warn("tema:", e); }

    /* Cajón en pantalla chica. */
    try {
      var r = document.documentElement;
      var burger = document.getElementById("burger");
      var scrim = document.getElementById("rail-scrim");
      function cajon(abrir) {
        r.dataset.rail = abrir ? "open" : "";
        burger.setAttribute("aria-expanded", abrir ? "true" : "false");
      }
      burger.addEventListener("click", function () { cajon(r.dataset.rail !== "open"); });
      scrim.addEventListener("click", function () { cajon(false); });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") cajon(false);
      });
      // Al volver a pantalla ancha el riel es fijo otra vez: si el estado
      // quedara abierto, el velo seguiría tapando la página entera.
      var mq = matchMedia("(min-width: 901px)");
      var alSalir = function (e) { if (e.matches) cajon(false); };
      if (mq.addEventListener) { mq.addEventListener("change", alSalir); }
      else if (mq.addListener) { mq.addListener(alSalir); }
    } catch (e) { console.warn("cajon:", e); }

    try { desplegables(document); } catch (e) { console.warn("desplegables:", e); }
    try { calendarios(document); }  catch (e) { console.warn("calendarios:", e); }
    try { importes(document); }     catch (e) { console.warn("importes:", e); }
    try { buscador(); }             catch (e) { console.warn("buscador:", e); }
    try { numeros(document); }      catch (e) { console.warn("numeros:", e); }

    /* ── Navegación optimista ─────────────────────────────────────────────
       Cada pantalla es un documento aparte, así que un click siempre es una
       carga completa. No se puede hacer instantánea sin volver todo esto una
       SPA, pero sí se pueden atacar las dos cosas que la hacen sentir lenta:

       1. Que no pase nada visible entre el click y la pantalla nueva. Se
          resuelve moviendo el estado activo en el acto y sacando una barra de
          progreso. El destino no llegó más rápido, pero el click responde.

       2. Que el HTML se empiece a pedir recién al soltar el botón. Se
          resuelve precargándolo al pasar el mouse por encima: entre que
          apuntás y hacés click pasan unos 200 ms, que alcanzan de sobra en
          red local y ayudan bastante fuera de ella. ────────────────────── */
    try {
      var precargados = {};
      function precargar(href) {
        if (!href || href === "#" || precargados[href]) return;
        precargados[href] = 1;
        var l = document.createElement("link");
        l.rel = "prefetch";
        l.href = href;
        document.head.appendChild(l);
      }

      // OJO con el nombre: "barra" a secas colisionaba con la función barra()
      // que arma la barra superior. Al ser var, se eleva al tope de init() y
      // la tapaba, así que init reventaba con "barra is not a function" justo
      // después de inyectar el riel y no llegaba a crear ni un ícono.
      var barraCarga = null;
      function progreso() {
        if (barraCarga) return;
        barraCarga = document.createElement("div");
        barraCarga.className = "cargando";
        document.body.appendChild(barraCarga);
        requestAnimationFrame(function () { barraCarga.dataset.on = "1"; });
      }

      document.querySelectorAll(".rail a[href]").forEach(function (a) {
        var href = a.getAttribute("href");
        if (!href || href.charAt(0) === "#") return;

        a.addEventListener("pointerenter", function () { precargar(href); });
        a.addEventListener("focus", function () { precargar(href); });

        a.addEventListener("click", function (e) {
          // Ctrl/Cmd/rueda abren en pestaña nueva: la pantalla actual se queda
          // donde está, así que mover el activo sería mentir.
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
          document.querySelectorAll(".rl[aria-current]").forEach(function (x) {
            x.removeAttribute("aria-current");
          });
          if (a.classList.contains("rl")) a.setAttribute("aria-current", "page");
          progreso();
        });
      });

      // Al volver con el botón de atrás la página sale de bfcache tal cual
      // quedó: con el activo movido y la barra a media asta. Hay que limpiar.
      window.addEventListener("pageshow", function (e) {
        if (!e.persisted) return;
        if (barraCarga) { barraCarga.remove(); barraCarga = null; }
      });
    } catch (e) { console.warn("navegacion:", e); }

    // Apaga el esqueleto del armazón. Va al final, después de que el riel y la
    // barra existen de verdad: si se marcara antes, el esqueleto se iría y
    // quedaría el hueco blanco, que es justo lo que vino a tapar.
    document.documentElement.dataset.listo = "1";
  }

  // Se exponen sueltos para las pantallas que arman marcado nuevo con JS y
  // necesitan enganchar sólo ese pedazo, sin volver a correr todo el armazón.
  window.Panel = {
    init: init,
    desplegables: desplegables,
    calendarios: calendarios,
    importes: importes,
    numeros: numeros
  };
})();
