"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";

import { savePerfilAction, type PerfilState } from "./actions";

type Initial = {
  name: string;
  slug: string;
  bio: string;
  instagramUrl: string;
  websiteUrl: string;
  avatarUrl: string;
};

export function PerfilForm({
  email,
  mpConnected,
  initial,
}: {
  email: string;
  mpConnected: boolean;
  initial: Initial;
}) {
  const [state, action, pending] = useActionState<PerfilState, FormData>(
    savePerfilAction,
    { error: null },
  );

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [bio, setBio] = useState(initial.bio);
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const BIO_MAX = 280;

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        previewUrl?: string;
      };
      if (!res.ok) {
        setAvatarError(data.error ?? "No pudimos subir la foto.");
      } else if (data.previewUrl) {
        setAvatarUrl(data.previewUrl);
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Error de red.");
    } finally {
      setAvatarUploading(false);
    }
  }

  // "Saved" toast for 2.5s
  const [savedToast, setSavedToast] = useState(false);
  useEffect(() => {
    if (state.saved) {
      setSavedToast(true);
      const t = setTimeout(() => setSavedToast(false), 2500);
      return () => clearTimeout(t);
    }
  }, [state.saved]);

  const initials =
    name
      .split(" ")
      .map((p) => p[0]?.toUpperCase() ?? "")
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "U";

  const fe = state.fieldErrors ?? {};

  return (
    <>
      {savedToast && (
        <div
          style={{
            position: "fixed",
            top: 84,
            right: 20,
            zIndex: 60,
            padding: "10px 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--success)",
            borderRadius: 10,
            color: "var(--success)",
            fontSize: 14,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
          }}
        >
          <i className="ti ti-circle-check-filled" />
          Cambios guardados
        </div>
      )}

      <form action={action} className="form-card">
        <div className="profile-pic-row">
          <div
            className="profile-pic"
            style={
              avatarUrl
                ? {
                    backgroundImage: `url(${avatarUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: "transparent",
                  }
                : undefined
            }
          >
            {!avatarUrl && initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{name || "Tu nombre"}</div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
              {email}
            </div>
            {avatarError && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--error)",
                  marginTop: 4,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <i className="ti ti-alert-circle" />
                {avatarError}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={onPickAvatar}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            style={{ padding: "8px 12px", fontSize: 13, height: 36 }}
          >
            {avatarUploading ? "Subiendo…" : avatarUrl ? "Cambiar foto" : "Subir foto"}
          </button>
        </div>

        <div className="form-row">
          <label>Nombre completo</label>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={fe.name ? "has-error" : undefined}
            required
          />
          {fe.name && (
            <div className="err">
              <i className="ti ti-alert-circle" />
              {fe.name}
            </div>
          )}
        </div>

        <div className="form-row">
          <label>Tu usuario</label>
          <div className={`input-with-prefix ${fe.slug ? "has-error" : ""}`}>
            <span className="pref">cuervito.app/</span>
            <input
              type="text"
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
          </div>
          {fe.slug ? (
            <div className="err">
              <i className="ti ti-alert-circle" />
              {fe.slug}
            </div>
          ) : (
            slug && (
              <div className="hint">
                Tu página pública:{" "}
                <Link href={`/${slug}`} style={{ color: "var(--accent)" }}>
                  cuervito.app/{slug}
                </Link>
              </div>
            )
          )}
        </div>

        <div className="form-row">
          <label>Email</label>
          <input
            type="email"
            value={email}
            disabled
            style={{ opacity: 0.55, cursor: "not-allowed" }}
          />
          <div className="hint">El email se usa para iniciar sesión. No se puede cambiar acá.</div>
        </div>

        <div className="form-row">
          <label>Bio (aparece en tu perfil público)</label>
          <textarea
            name="bio"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={BIO_MAX}
            className={fe.bio ? "has-error" : undefined}
            required
          />
          {fe.bio ? (
            <div className="err">
              <i className="ti ti-alert-circle" />
              {fe.bio}
            </div>
          ) : (
            <div className="hint">
              {bio.length}/{BIO_MAX} caracteres
            </div>
          )}
        </div>

        <div className="form-grid-2">
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Instagram (opcional)</label>
            <div className="input-with-prefix">
              <span className="pref">@</span>
              <input
                type="text"
                name="instagramUrl"
                placeholder="tu-usuario"
                defaultValue={initial.instagramUrl}
              />
            </div>
          </div>

          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Sitio web (opcional)</label>
            <input
              type="url"
              name="websiteUrl"
              placeholder="https://tu-sitio.com"
              defaultValue={initial.websiteUrl}
              className={fe.websiteUrl ? "has-error" : undefined}
            />
            {fe.websiteUrl && (
              <div className="err">
                <i className="ti ti-alert-circle" />
                {fe.websiteUrl}
              </div>
            )}
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 16 }}>
          <label>Cobros · Mercado Pago</label>
          {mpConnected ? (
            <div className="mp-inline-status connected">
              <i className="ti ti-circle-check-filled" />
              <div className="info">
                <div className="ttl">Cuenta vinculada</div>
                <div className="sub">Las ventas se acreditan automáticamente.</div>
              </div>
              <Link
                href="/dashboard/cobros"
                className="btn btn-ghost"
                style={{ padding: "6px 10px", fontSize: 12, height: "auto" }}
              >
                Cambiar
              </Link>
            </div>
          ) : (
            <div className="mp-inline-status pending">
              <i className="ti ti-alert-triangle" />
              <div className="info">
                <div className="ttl">Sin conectar</div>
                <div className="sub">No vas a recibir ventas hasta vincular tu cuenta.</div>
              </div>
              <Link
                href="/onboarding/mp"
                className="btn btn-primary"
                style={{ padding: "6px 12px", fontSize: 12, height: "auto" }}
              >
                Conectar
              </Link>
            </div>
          )}
        </div>

        {state.error && !state.fieldErrors && (
          <div
            className="err"
            style={{
              marginTop: 16,
              padding: "10px 14px",
              border: "1px solid rgba(224,85,85,0.4)",
              borderRadius: 8,
            }}
          >
            <i className="ti ti-alert-circle" />
            {state.error}
          </div>
        )}

        <div className="form-actions">
          <Link href="/dashboard" className="btn btn-outline">
            Cancelar
          </Link>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </form>
    </>
  );
}
