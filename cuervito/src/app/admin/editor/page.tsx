import Link from "next/link";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { resolveMediaUrl } from "~/server/media";

import { deleteProject } from "./actions";
import { NewProjectPicker } from "./new-project-picker";

export default async function AdminEditorPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const all = await db.editorProject.findMany({
    where: { ownerId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      sourceKey: true,
      width: true,
      height: true,
      updatedAt: true,
      isTemplate: true,
    },
  });

  const withThumbs = await Promise.all(
    all.map(async (p) => ({
      ...p,
      thumbUrl: p.sourceKey ? await resolveMediaUrl(p.sourceKey).catch(() => null) : null,
    })),
  );

  const projects = withThumbs.filter((p) => !p.isTemplate);
  const templates = withThumbs.filter((p) => p.isTemplate);

  return (
    <main className="wrap-narrow">
      <div className="head">
        <div>
          <h1>Editor</h1>
          <div className="sub">
            Editor visual de posts. Privado — solo admins, en pruebas (Nivel 1 del spec).
          </div>
        </div>
        <NewProjectPicker
          templates={templates.map((t) => ({
            id: t.id,
            name: t.name,
            width: t.width,
            height: t.height,
            thumbUrl: t.thumbUrl,
          }))}
        />
      </div>

      {templates.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <SectionHeader
            label="Plantillas"
            hint={`${templates.length} ${templates.length === 1 ? "plantilla" : "plantillas"}`}
          />
          <CardGrid>
            {templates.map((t) => (
              <ProjectCard key={t.id} project={t} kind="template" />
            ))}
          </CardGrid>
        </section>
      )}

      <section>
        <SectionHeader
          label="Proyectos"
          hint={
            projects.length === 0
              ? "Sin proyectos"
              : `${projects.length} ${projects.length === 1 ? "proyecto" : "proyectos"}`
          }
        />
        {projects.length === 0 ? (
          <EmptyState />
        ) : (
          <CardGrid>
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} kind="project" />
            ))}
          </CardGrid>
        )}
      </section>
    </main>
  );
}

function SectionHeader({ label, hint }: { label: string; hint: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 12,
        padding: "0 4px",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "-0.015em",
          color: "var(--text-primary)",
        }}
      >
        {label}
      </h2>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {hint}
      </span>
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

type ProjectRow = {
  id: string;
  name: string;
  sourceKey: string | null;
  width: number;
  height: number;
  updatedAt: Date;
  thumbUrl: string | null;
  isTemplate: boolean;
};

function ProjectCard({
  project,
  kind,
}: {
  project: ProjectRow;
  kind: "project" | "template";
}) {
  return (
    <article
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${kind === "template" ? "var(--border-accent)" : "var(--border-subtle)"}`,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {kind === "template" && (
        <span
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            zIndex: 1,
            padding: "3px 8px",
            background: "rgba(245,130,10,0.92)",
            color: "#1a0d00",
            fontFamily: "var(--font-mono)",
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            borderRadius: 999,
            backdropFilter: "blur(4px)",
          }}
        >
          Plantilla
        </span>
      )}
      <Link
        href={`/admin/editor/${project.id}`}
        style={{
          display: "block",
          aspectRatio: `${project.width} / ${project.height}`,
          background: project.thumbUrl
            ? `url(${project.thumbUrl}) center/cover`
            : "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))",
          position: "relative",
          textDecoration: "none",
        }}
      >
        {!project.thumbUrl && (
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
            {kind === "template" ? "Plantilla en blanco" : "Sin foto fuente"}
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
            href={`/admin/editor/${project.id}`}
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
            {project.name}
          </Link>
          <div
            style={{
              fontSize: 11,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {project.width}×{project.height} ·{" "}
            {new Date(project.updatedAt).toLocaleDateString("es-AR", {
              day: "numeric",
              month: "short",
            })}
          </div>
        </div>
        <form action={deleteProject.bind(null, project.id)}>
          <button
            type="submit"
            aria-label="Eliminar"
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
  );
}

function EmptyState() {
  return (
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
        Apretá <strong>Nuevo proyecto</strong> para abrir el canvas o partir de
        una plantilla.
      </div>
    </div>
  );
}
