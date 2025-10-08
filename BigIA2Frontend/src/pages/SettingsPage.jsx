import React, { useEffect, useState } from "react";
import api from "../api/axiosInstance";
import { useApp } from "../context/AppContext";
import "./pagesStyles/SettingsPage.css"; // <-- asegúrate de la ruta

const DEFAULTS = {
  topbar_color: "#6cab3c",     // el verde del “antes” como default visual
  topbar_text: "BigIA 2.0",
  document_title: "BigIA 2.0",
  login_message: "Acceso a BigIA 2.0",
};

export default function Settings() {
  const { setTopbarStyle } = useApp?.() || { setTopbarStyle: () => {} };

  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // aplica variables CSS para que todo el tema adopte el color
  const applyThemeVars = (hex) => {
    const root = document.documentElement;
    root.style.setProperty("--topbar-bg", hex);
    // opcional: si usas acentos primarios
    root.style.setProperty("--brand", hex);
  };

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/settings");
        if (cancel) return;
        const cfg = { ...DEFAULTS, ...(data || {}) };
        setForm(cfg);
        document.title = cfg.document_title || DEFAULTS.document_title;
        applyThemeVars(cfg.topbar_color || DEFAULTS.topbar_color);
        setTopbarStyle?.({ color: cfg.topbar_color, text: cfg.topbar_text });
      } catch (e) {
        console.warn("GET /settings", e);
        // deja defaults si falla
        applyThemeVars(DEFAULTS.topbar_color);
        setTopbarStyle?.({ color: DEFAULTS.topbar_color, text: DEFAULTS.topbar_text });
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, []);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (name === "topbar_color") {
      applyThemeVars(value);
      setTopbarStyle?.({ color: value, text: form.topbar_text });
    }
    if (name === "document_title") {
      document.title = value || DEFAULTS.document_title;
    }
  };

  const restoreDefaults = () => {
    setForm(DEFAULTS);
    applyThemeVars(DEFAULTS.topbar_color);
    setTopbarStyle?.({ color: DEFAULTS.topbar_color, text: DEFAULTS.topbar_text });
    document.title = DEFAULTS.document_title;
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        topbar_color: form.topbar_color || DEFAULTS.topbar_color,
        topbar_text: form.topbar_text || DEFAULTS.topbar_text,
        document_title: form.document_title || DEFAULTS.document_title,
        login_message: form.login_message || DEFAULTS.login_message,
      };
      const { data } = await api.post("/settings", payload);
      applyThemeVars(data.topbar_color);
      setTopbarStyle?.({ color: data.topbar_color, text: data.topbar_text });
      if (data.document_title) document.title = data.document_title;
      alert("Guardado");
    } catch (e) {
      console.error("POST /settings", e);
      alert(e?.response?.data?.error || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="settings-shell"><div className="settings-card">Cargando…</div></div>;

  return (
    <div className="settings-shell">
      <h1 className="settings-title">Personalización</h1>

      <div className="settings-card">
        <p className="settings-subtitle">Personalización de la aplicación</p>

        <form onSubmit={onSave} className="settings-grid">
          {/* Texto barra */}
          <div className="field field--left">
            <label>Texto de la barra</label>
            <input
              type="text"
              name="topbar_text"
              value={form.topbar_text}
              onChange={onChange}
              placeholder="BigIA 2.0"
            />
          </div>

          {/* Color barra */}
          <div className="field field--right">
            <label>Color de la barra</label>
            <div className="color-row">
              <input
                className="color-input"
                type="color"
                name="topbar_color"
                value={form.topbar_color}
                onChange={onChange}
                aria-label="Color de la barra"
              />
            </div>
          </div>

          {/* Título documento */}
          <div className="field field--left">
            <label>Título del documento</label>
            <input
              type="text"
              name="document_title"
              value={form.document_title}
              onChange={onChange}
              placeholder="BigIA 2.0"
            />
          </div>

          {/* Mensaje login */}
          <div className="field field--full">
            <label>Mensaje de login</label>
            <input
              type="text"
              name="login_message"
              value={form.login_message}
              onChange={onChange}
              placeholder="Acceso a BigIA 2.0"
            />
          </div>

          {/* Acciones */}
          <div className="actions">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
            <button type="button" className="btn" onClick={restoreDefaults}>
              Restaurar por defecto
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
