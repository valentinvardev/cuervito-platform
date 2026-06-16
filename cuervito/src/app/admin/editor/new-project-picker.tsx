"use client";

import { useEffect, useState, useTransition } from "react";

import { createProject, createProjectFromTemplate } from "./actions";

type TemplateOption = {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbUrl: string | null;
};

/**
 * Toolbar button + modal that lets the admin start a project either blank or
 * from one of their existing templates. Wraps the two server actions in a
 * useTransition so the modal can show "Creando…" feedback.
 */
export function NewProjectPicker({ templates }: { templates: TemplateOption[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, pending]);

  function startBlank() {
    startTransition(() => {
      void createProject();
    });
  }

  function startFromTemplate(templateId: string) {
    startTransition(() => {
      void createProjectFromTemplate(templateId);
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        <i className="ti ti-plus" />
        Nuevo proyecto
      </button>

      {open && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
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
              borderRadius: 16,
              padding: 22,
              maxWidth: 720,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
            }}
          >
            <header
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 700,
                    fontSize: 20,
                    letterSpacing: "-0.02em",
                  }}
                >
                  Nuevo proyecto
                </h2>
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--text-tertiary)",
                    marginTop: 2,
                  }}
                >
                  Empezá en blanco o partí de una plantilla.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                aria-label="Cerrar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-secondary)",
                  cursor: pending ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <i className="ti ti-x" />
              </button>
            </header>

            <button
              type="button"
              onClick={startBlank}
              disabled={pending}
              style={{
                width: "100%",
                padding: "16px 18px",
                borderRadius: 12,
                background: "var(--bg-base)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-primary)",
                cursor: pending ? "wait" : "pointer",
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
                textAlign: "left",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "var(--accent-deep)",
                  border: "1px solid var(--border-accent)",
                  color: "var(--accent)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                <i className="ti ti-square-plus" />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontWeight: 500 }}>Canvas en blanco</span>
                <span
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-tertiary)",
                  }}
                >
                  1080 × 1080 px. Subís foto y agregás capas desde cero.
                </span>
              </span>
              <i
                className="ti ti-arrow-right"
                style={{ color: "var(--text-tertiary)" }}
              />
            </button>

            {templates.length > 0 && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    margin: "0 0 12px",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    color: "var(--text-tertiary)",
                  }}
                >
                  <span
                    style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
                  />
                  <span>o desde una plantilla</span>
                  <span
                    style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
                  />
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
                    gap: 12,
                  }}
                >
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => startFromTemplate(t.id)}
                      disabled={pending}
                      style={{
                        padding: 0,
                        background: "var(--bg-base)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 10,
                        overflow: "hidden",
                        cursor: pending ? "wait" : "pointer",
                        textAlign: "left",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <div
                        style={{
                          aspectRatio: `${t.width} / ${t.height}`,
                          background: t.thumbUrl
                            ? `url(${t.thumbUrl}) center/cover`
                            : "linear-gradient(135deg, var(--bg-elevated), var(--bg-surface))",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-tertiary)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                        }}
                      >
                        {!t.thumbUrl && "Sin foto"}
                      </div>
                      <div
                        style={{
                          padding: "8px 10px",
                          fontSize: 12.5,
                          fontWeight: 500,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {t.name}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {pending && (
              <div
                style={{
                  marginTop: 14,
                  textAlign: "center",
                  color: "var(--text-tertiary)",
                  fontSize: 12.5,
                }}
              >
                <span className="up-spinner" style={{ marginRight: 6 }} />
                Creando proyecto…
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
