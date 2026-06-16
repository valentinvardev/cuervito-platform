"use client";

import { useState, useTransition } from "react";

import {
  createFolder,
  deleteFolder,
  moveProjectToFolder,
  renameFolder,
  setFolderEvent,
} from "./actions";

export type FolderRow = {
  id: string;
  name: string;
  eventId: string | null;
  eventName: string | null;
  projectCount: number;
};

export type EventOption = {
  id: string;
  name: string;
};

export type ProjectRow = {
  id: string;
  name: string;
  width: number;
  height: number;
  updatedAt: Date | string;
  thumbUrl: string | null;
  isTemplate: boolean;
  folderId: string | null;
};

/**
 * Two-column layout for the editor list page:
 *   - left: folder sidebar (Todo / cada carpeta / Sin carpeta)
 *   - right: the project grid filtered by the selected folder
 *
 * Templates live separately and aren't folderable for now.
 */
export function FoldersShell({
  folders,
  projects,
  templates,
  events,
  children,
}: {
  folders: FolderRow[];
  projects: ProjectRow[];
  templates: ProjectRow[];
  events: EventOption[];
  /** Slot for the "Nuevo proyecto" picker rendered server-side. */
  children: React.ReactNode;
}) {
  /** "all" = mostrar todos los proyectos (incluye los de carpetas + sin carpeta).
   *  "none" = solo los proyectos sin carpeta.
   *  cualquier otro string = id de la carpeta seleccionada. */
  const [selected, setSelected] = useState<"all" | "none" | string>("all");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const filteredProjects =
    selected === "all"
      ? projects
      : selected === "none"
        ? projects.filter((p) => p.folderId === null)
        : projects.filter((p) => p.folderId === selected);

  const selectedFolder =
    selected !== "all" && selected !== "none"
      ? folders.find((f) => f.id === selected) ?? null
      : null;

  return (
    <main className="wrap-narrow" style={{ paddingTop: 16 }}>
      <div className="head">
        <div>
          <h1>Editor</h1>
          <div className="sub">
            Editor visual de posts. Privado — solo admins, en pruebas.
          </div>
        </div>
        {children}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "220px 1fr",
          gap: 18,
          minHeight: 400,
        }}
      >
        {/* ── Sidebar ────────────────────────────────────────── */}
        <aside
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            padding: "10px 8px",
            height: "fit-content",
          }}
        >
          <SidebarHeader label="Carpetas" onAdd={() => setNewFolderOpen(true)} />
          <FolderRowItem
            active={selected === "all"}
            label="Todos"
            icon="ti-folders"
            count={projects.length}
            onClick={() => setSelected("all")}
          />
          <FolderRowItem
            active={selected === "none"}
            label="Sin carpeta"
            icon="ti-inbox"
            count={projects.filter((p) => p.folderId === null).length}
            onClick={() => setSelected("none")}
          />
          {folders.length > 0 && <Divider />}
          {folders.map((f) => (
            <FolderRowItem
              key={f.id}
              active={selected === f.id}
              label={f.name}
              sub={f.eventName ?? undefined}
              icon="ti-folder"
              count={f.projectCount}
              onClick={() => setSelected(f.id)}
            />
          ))}
        </aside>

        {/* ── Main area ────────────────────────────────────── */}
        <div style={{ minWidth: 0 }}>
          {selectedFolder && (
            <FolderToolbar
              folder={selectedFolder}
              events={events}
              pending={pending}
              onRename={(name) =>
                startTransition(async () => {
                  await renameFolder(selectedFolder.id, name);
                })
              }
              onLinkEvent={(eventId) =>
                startTransition(async () => {
                  await setFolderEvent(selectedFolder.id, eventId);
                })
              }
              onDelete={() => {
                if (
                  !confirm(
                    `¿Eliminar la carpeta "${selectedFolder.name}"? Los proyectos no se borran, vuelven a quedar sin carpeta.`,
                  )
                )
                  return;
                startTransition(async () => {
                  await deleteFolder(selectedFolder.id);
                  setSelected("all");
                });
              }}
            />
          )}

          {/* Templates */}
          {selected === "all" && templates.length > 0 && (
            <Section
              label="Plantillas"
              hint={`${templates.length} ${templates.length === 1 ? "plantilla" : "plantillas"}`}
            >
              <ProjectGrid>
                {templates.map((t) => (
                  <ProjectCard
                    key={t.id}
                    project={t}
                    folders={folders}
                    kind="template"
                  />
                ))}
              </ProjectGrid>
            </Section>
          )}

          {/* Projects */}
          <Section
            label={selectedFolder ? selectedFolder.name : "Proyectos"}
            hint={
              filteredProjects.length === 0
                ? "Vacío"
                : `${filteredProjects.length} ${
                    filteredProjects.length === 1 ? "proyecto" : "proyectos"
                  }`
            }
          >
            {filteredProjects.length === 0 ? (
              <EmptyState />
            ) : (
              <ProjectGrid>
                {filteredProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    folders={folders}
                    kind="project"
                  />
                ))}
              </ProjectGrid>
            )}
          </Section>
        </div>
      </div>

      {newFolderOpen && (
        <NewFolderDialog
          events={events}
          onCancel={() => setNewFolderOpen(false)}
          onCreate={(name, eventId) => {
            startTransition(async () => {
              const res = await createFolder(name, eventId);
              if (!res.error && res.folderId) {
                setSelected(res.folderId);
                setNewFolderOpen(false);
              }
            });
          }}
          pending={pending}
        />
      )}
    </main>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────
function SidebarHeader({
  label,
  onAdd,
}: {
  label: string;
  onAdd: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 10px 10px",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10.5,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onAdd}
        title="Nueva carpeta"
        style={{
          width: 22,
          height: 22,
          borderRadius: 5,
          background: "transparent",
          border: "1px solid var(--border-subtle)",
          color: "var(--text-secondary)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        <i className="ti ti-plus" />
      </button>
    </div>
  );
}

function FolderRowItem({
  active,
  label,
  sub,
  icon,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  sub?: string;
  icon: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 8,
        background: active ? "var(--accent-deep)" : "transparent",
        border: active
          ? "1px solid var(--border-accent)"
          : "1px solid transparent",
        color: active ? "var(--accent)" : "var(--text-primary)",
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        fontSize: 13,
        marginBottom: 2,
      }}
    >
      <i
        className={`ti ${icon}`}
        style={{ fontSize: 15, color: active ? "var(--accent)" : "var(--text-tertiary)" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {label}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-tertiary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "var(--font-mono)",
            }}
          >
            {sub}
          </div>
        )}
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-tertiary)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        margin: "6px 10px",
        height: 1,
        background: "var(--border-subtle)",
      }}
    />
  );
}

function FolderToolbar({
  folder,
  events,
  pending,
  onRename,
  onLinkEvent,
  onDelete,
}: {
  folder: FolderRow;
  events: EventOption[];
  pending: boolean;
  onRename: (name: string) => void;
  onLinkEvent: (eventId: string | null) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(folder.name);
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "center",
        padding: "10px 12px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 10,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          if (name.trim() && name.trim() !== folder.name) onRename(name.trim());
          else setName(folder.name);
        }}
        style={{
          flex: 1,
          minWidth: 140,
          background: "var(--bg-base)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 7,
          padding: "7px 10px",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 500,
          outline: "none",
        }}
      />
      <select
        value={folder.eventId ?? ""}
        onChange={(e) => onLinkEvent(e.target.value || null)}
        disabled={pending}
        style={{
          background: "var(--bg-base)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 7,
          padding: "7px 10px",
          color: "var(--text-primary)",
          fontSize: 12.5,
          minWidth: 180,
        }}
      >
        <option value="">Sin evento vinculado</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>
            {ev.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onDelete}
        disabled={pending}
        title="Eliminar carpeta"
        style={{
          width: 32,
          height: 32,
          borderRadius: 7,
          background: "transparent",
          border: "1px solid rgba(224,85,85,0.4)",
          color: "var(--error)",
          cursor: pending ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <i className="ti ti-trash" />
      </button>
    </div>
  );
}

function Section({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 10,
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
      {children}
    </section>
  );
}

function ProjectGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
        gap: 14,
      }}
    >
      {children}
    </div>
  );
}

function ProjectCard({
  project,
  folders,
  kind,
}: {
  project: ProjectRow;
  folders: FolderRow[];
  kind: "project" | "template";
}) {
  const [movePending, startMove] = useTransition();
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
      <a
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
              fontSize: 12,
              fontFamily: "var(--font-mono)",
            }}
          >
            {kind === "template" ? "Plantilla en blanco" : "Sin foto"}
          </div>
        )}
      </a>
      <div
        style={{
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={`/admin/editor/${project.id}`}
            style={{
              display: "block",
              fontWeight: 500,
              fontSize: 13.5,
              color: "var(--text-primary)",
              textDecoration: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {project.name}
          </a>
          <div
            style={{
              fontSize: 10.5,
              color: "var(--text-tertiary)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {project.width}×{project.height}
          </div>
        </div>
        {kind === "project" && (
          <select
            value={project.folderId ?? ""}
            disabled={movePending}
            onChange={(e) =>
              startMove(async () => {
                await moveProjectToFolder(project.id, e.target.value || null);
              })
            }
            title="Mover a carpeta"
            style={{
              background: "var(--bg-base)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              color: "var(--text-secondary)",
              fontSize: 11,
              padding: "3px 4px",
              maxWidth: 96,
            }}
          >
            <option value="">Sin carpeta</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: 40,
        textAlign: "center",
        background: "var(--bg-surface)",
        border: "1px dashed var(--border-default)",
        borderRadius: 12,
        color: "var(--text-tertiary)",
        fontSize: 13,
      }}
    >
      Nada por acá. Movés un proyecto a esta carpeta desde el selector en la
      esquina inferior de cada card.
    </div>
  );
}

function NewFolderDialog({
  events,
  onCancel,
  onCreate,
  pending,
}: {
  events: EventOption[];
  onCancel: () => void;
  onCreate: (name: string, eventId: string | null) => void;
  pending: boolean;
}) {
  const [name, setName] = useState("");
  const [eventId, setEventId] = useState<string>("");
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onCancel();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(8,6,5,0.72)",
        backdropFilter: "blur(6px)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 14,
          padding: 22,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "-0.015em",
            marginBottom: 4,
          }}
        >
          Nueva carpeta
        </h3>
        <p
          style={{
            fontSize: 12.5,
            color: "var(--text-tertiary)",
            marginBottom: 14,
            lineHeight: 1.5,
          }}
        >
          Agrupá proyectos relacionados. Opcionalmente vinculala a un evento
          (carrera) para tener tus ediciones organizadas por competencia.
        </p>
        <label
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 4,
          }}
        >
          Nombre
        </label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Maratón Buenos Aires 2025"
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
            marginBottom: 12,
          }}
        />
        <label
          style={{
            display: "block",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 4,
          }}
        >
          Vincular a evento (opcional)
        </label>
        <select
          value={eventId}
          onChange={(e) => setEventId(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "var(--bg-base)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 8,
            color: "var(--text-primary)",
            fontSize: 13,
            outline: "none",
            marginBottom: 16,
          }}
        >
          <option value="">Sin evento vinculado</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancel}
            disabled={pending}
            style={{ height: 32, padding: "0 14px", fontSize: 13 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onCreate(name, eventId || null)}
            disabled={pending || !name.trim()}
            style={{ height: 32, padding: "0 14px", fontSize: 13 }}
          >
            {pending ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
