/**
 * Cómo corre la app en el VPS.
 *
 * Estaba sin versionar: la configuración vivía sólo en el `pm2 save` de la
 * máquina, así que nadie podía leer con qué parámetros corre lo que sirve el
 * sitio, ni reproducirlo si hay que levantar otro servidor.
 *
 * Las dos decisiones que importan:
 *
 * ── kill_timeout: 30000 ──────────────────────────────────────────────────
 * El default de pm2 es 1.600 ms entre el SIGINT y el SIGKILL. Generar la marca
 * de agua de UNA foto tarda unos cinco segundos, así que cada `pm2 restart`
 * mataba a la mitad todo lo que estuviera procesando. Eso, más que el trabajo
 * viviera en memoria, es lo que dejó 160 fotos invisibles la noche de los tres
 * deploys seguidos.
 *
 * Ahora el trabajo pendiente vive en la base y se recupera solo, así que esto
 * ya no es la diferencia entre perder y no perder: es la diferencia entre
 * terminar lo empezado y tener que rehacerlo. Treinta segundos alcanzan para
 * que las cuatro fotos en vuelo terminen y suelten su lease.
 *
 * ── exec_mode: fork, instances: 1 ────────────────────────────────────────
 * No es "todavía no lo escalamos": es un requisito de cómo se recupera el
 * trabajo. Al arrancar, la cola libera todo lease vigente porque asume que si
 * hay uno vivo es de un proceso muerto —con una sola instancia, eso es cierto—.
 * En cluster esa suposición es falsa: el lease podría ser de otra instancia
 * trabajando en ese mismo momento, y liberarlo pondría dos procesos sobre la
 * misma foto. Si algún día hace falta cluster, hay que poner
 * PROCESADOR_UNICA_INSTANCIA=false y aceptar esperar los diez minutos del lease
 * después de cada deploy.
 *
 * Tampoco se usa `reload` con drenado ni NEXT_MANUAL_SIG_HANDLE. En cluster el
 * master sigue mandando conexiones nuevas al worker viejo hasta que su handle
 * de escucha se cierra, y con el handler manual nadie llama a server.close():
 * el "drenado" termina cortando a la mitad pedidos que él mismo aceptó, que es
 * peor que los tres segundos de rechazo limpio de un restart en fork. La
 * garantía de no perder trabajo la da el lease, no el drenado.
 *
 * ── Por qué apunta al binario de next y no a `npm start` ─────────────────
 * Con npm en el medio, la señal le llega a npm y npm decide qué hacer con
 * ella. Apuntando directo al binario, el SIGINT llega al proceso que tiene que
 * enterarse.
 *
 * ── El puerto: 3005 ─────────────────────────────────────────────────────
 * Sale de /etc/nginx/sites-available/cuervito, que hace
 * `proxy_pass http://localhost:3005`. No es un número elegido acá: es el que
 * nginx ya está esperando del otro lado, y este archivo sólo lo repite.
 *
 * Esto ya se rompió una vez, el 9 de septiembre de 2026: la primera versión de
 * este archivo decía 3000 —copiado de un ejemplo, sin mirar nginx— y 3000 es de
 * otro proyecto del mismo servidor. cuervito no pudo levantar, pm2 lo reintentó
 * quince veces y el sitio estuvo caído hasta que se corrigió. El servidor tiene
 * nueve aplicaciones Next, cada una en su puerto; acá no se inventa ninguno.
 *
 * Se aplica una sola vez:
 *   pm2 delete cuervito && pm2 start ecosystem.config.cjs && pm2 save
 */
module.exports = {
  apps: [
    {
      name: "cuervito",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3005",
      exec_mode: "fork",
      instances: 1,
      kill_timeout: 30000,
      env: { NODE_ENV: "production" },
    },
  ],
};
