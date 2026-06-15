import Link from "next/link";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { createProject, deleteProject } from "./actions";

export default async function AdminEditorPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const projects = await db.editorProject.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      sourceKey: true,
      width: true,
      height: true,
      updatedAt: true,
    },
  });

  const projectsWithThumb = await Promise.all(
    projects.map(async (p) => ({
      ...p,
      thumbUrl: p.sourceKey ? await resolveMediaUrl(p.sourceKey).catch(() => null) : null,
    })),
  );

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Editor</h1>
          <div className="sub">
            Editor visual de posts. Privado — solo admins, en pruebas (Nivel 1 del spec).
          </div>
        </div>
        <form action={createProject}>
          <button type="submit" className="btn btn-primary">
            <i className="ti ti-plus" />
            Nuevo proyecto
          </button>
        </form>
      </div>

      {projectsWithThumb.length === 0 ? (
        <div
          style={{
            padding: 60,
            textAlign: "center",
            background: "var(--bg-surface)",
            border: "1px dashed var(--border-default)",
            borderRadius: 14,
            color: "var(--text-tertiary)",
          }}
        >
          <i
            className="ti ti-photo-edit"
            style={{ fontSize: 40, color: "var(--accent)", marginBottom: 12 }}
          />
          <div style={{ fontSize: 15, color: "var(--text-secondary)" }}>
            Todavía no creaste proyectos.
          </div>
          <div style={{ fontSize: 13, marginTop: 4 }}>
            Apretá <strong>Nuevo proyecto</strong> para abrir el canvas.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
          }}
        >
          {projectsWithThumb.map((p) => (
            <article
              key={p.id}
              style={{
                background: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 12,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              <Link
                href={`/admin/editor/${p.id}`}
                style={{
                  display: "block",
                  aspectRatio: `${p.width} / ${p.height}`,
                  background: p.thumbUrl
                    ? `url(${p.thumbUrl}) center/cover`
                    : "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))",
                  position: "relative",
                  textDecoration: "none",
                }}
              >
                {!p.thumbUrl && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-tertiary)",
                      fontSize: 13,
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    Sin foto fuente
                  </div>
                )}
              </Link>
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <Link
                    href={`/admin/editor/${p.id}`}
                    style={{
                      display: "block",
                      fontWeight: 500,
                      fontSize: 14,
                      color: "var(--text-primary)",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {p.name}
                  </Link>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      fontFamily: "var(--font-mono)",
                    }}
                  >
                    {p.width}×{p.height} ·{" "}
                    {new Date(p.updatedAt).toLocaleDateString("es-AR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </div>
                </div>
                <form action={deleteProject.bind(null, p.id)}>
                  <button
                    type="submit"
                    aria-label="Eliminar proyecto"
                    title="Eliminar"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-tertiary)",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <i className="ti ti-trash" style={{ fontSize: 14 }} />
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
