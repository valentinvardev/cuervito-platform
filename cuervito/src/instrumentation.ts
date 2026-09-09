/**
 * Lo que corre una vez, cuando arranca el proceso.
 *
 * Next llama a register() al levantar el servidor. Es el único lugar donde se
 * puede poner algo que viva más que una request, y por eso acá arranca la cola
 * de fotos: es lo que hace que un `pm2 restart` a mitad de una tanda no pierda
 * el trabajo pendiente, sino que lo retome.
 *
 * La forma del `if` importa y no es estilo. Existe src/middleware.ts, así que
 * Next compila este archivo TAMBIÉN para el runtime edge, donde no hay
 * child_process ni https y sharp no puede ni importarse. webpack elimina un
 * import dinámico sólo cuando está adentro de un `if` cuya condición puede
 * resolver en tiempo de compilación: con un `return` temprano no lo hace, deja
 * el import vivo, y el build se cae con "Module not found: child_process" con
 * el rastro apuntando acá.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { arrancarCola } = await import("~/server/cola-fotos");
    arrancarCola();
  }
}
