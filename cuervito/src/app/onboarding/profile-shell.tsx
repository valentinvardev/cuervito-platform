"use client";

import { useActionState, useEffect, useState } from "react";

import { saveProfileAction, type ProfileState } from "./actions";
import { ObShell } from "./ob-shell";

type Initial = {
  name: string;
  slug: string;
  bio: string;
  instagramUrl: string;
  websiteUrl: string;
};

function suggestSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function ProfileShell({ initial }: { initial: Initial }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    saveProfileAction,
    { error: null },
  );

  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  useEffect(() => {
    if (!slugTouched) setSlug(suggestSlug(name));
  }, [name, slugTouched]);

  const [bio, setBio] = useState(initial.bio);
  const BIO_MAX = 280;

  const fe = state.fieldErrors ?? {};

  return (
    <ObShell step={1}>
      <form action={action} className="step-content">
        <div className="ob-form-head">
          <span className="ob-eyebrow">Paso 1 de 2</span>
          <h1>Empecemos por vos.</h1>
          <p>Esta info aparece en tu perfil público y junto a tus fotos del evento.</p>
        </div>

        <div className="form-grid">
          <div className="field full">
            <label className="label">Nombre completo</label>
            <input
              name="name"
              className={`input ${fe.name ? "input-error" : ""}`}
              placeholder="Ana Liotta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
            {fe.name && <div className="field-error"><i className="ti ti-alert-circle" />{fe.name}</div>}
          </div>

          <div className="field full">
            <label className="label">Tu usuario</label>
            <div className={`input-group ${fe.slug ? "input-error" : ""}`}>
              <span className="prefix">cuervito.app/</span>
              <input
                name="slug"
                placeholder="ana-liotta"
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugTouched(true);
                }}
                required
              />
            </div>
            {fe.slug
              ? <div className="field-error"><i className="ti ti-alert-circle" />{fe.slug}</div>
              : <div className="field-hint">Esta va a ser la dirección de tu galería pública.</div>}
          </div>

          <div className="field full">
            <label className="label">Bio profesional</label>
            <textarea
              name="bio"
              className={`input ${fe.bio ? "input-error" : ""}`}
              placeholder="Fotógrafa de running y trail con base en Mendoza. 5 años cubriendo carreras de calle, ultra y montaña."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={BIO_MAX}
              required
            />
            {fe.bio
              ? <div className="field-error"><i className="ti ti-alert-circle" />{fe.bio}</div>
              : <div className="field-hint">{bio.length}/{BIO_MAX} caracteres</div>}
          </div>

          <div className="field full">
            <label className="label">Instagram (opcional)</label>
            <div className="input-group">
              <span className="prefix">@</span>
              <input
                name="instagramUrl"
                placeholder="analiotta.foto"
                defaultValue={initial.instagramUrl}
              />
            </div>
          </div>

          <div className="field full">
            <label className="label">Sitio web (opcional)</label>
            <input
              type="url"
              name="websiteUrl"
              className={`input ${fe.websiteUrl ? "input-error" : ""}`}
              placeholder="https://analiotta.com"
              defaultValue={initial.websiteUrl}
            />
            {fe.websiteUrl && <div className="field-error"><i className="ti ti-alert-circle" />{fe.websiteUrl}</div>}
          </div>
        </div>

        {state.error && !state.fieldErrors && (
          <div
            className="field-error"
            style={{ marginTop: 16, padding: "10px 14px", border: "1px solid rgba(224,85,85,0.4)", borderRadius: 8 }}
          >
            <i className="ti ti-alert-circle" />
            {state.error}
          </div>
        )}

        <div className="ob-actions">
          <button type="button" className="btn btn-ghost btn-back" style={{ visibility: "hidden" }}>
            <i className="ti ti-arrow-left" />Atrás
          </button>
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>
            <span>{pending ? "Guardando…" : "Continuar"}</span> <i className="ti ti-arrow-right" />
          </button>
        </div>
      </form>
    </ObShell>
  );
}
