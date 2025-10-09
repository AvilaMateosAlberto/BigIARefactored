// src/pages/ReportPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./pagesStyles/ReportPage.css";
import { getItem, setItem } from "../utils/storage";
import { useConfig } from "../context/ConfigContext";

const LS_KEY = "reports_page_state_v1_min";

const DEFAULTS = {
  title: "Reportes",
  baseUrl: "",
  path: "/index.html",
  collapsed: true, // por defecto plegado
  clientName: "Cliente Prueba",
  author: "SOC Team",
  notes: "Nada que destacar de momento.",
  clientLogoDataUrl: "", // preview base64
};

export default function ReportPage() {
  const { config } = useConfig();
  const [state, setState] = useState(() => getItem(LS_KEY) || { ...DEFAULTS });
  const [mounted, setMounted] = useState(false);

  useEffect(() => { document.title = state.title || "Reportes"; }, [state.title]);

  useEffect(() => { if (mounted) setItem(LS_KEY, state); }, [state, mounted]);
  useEffect(() => { setMounted(true); }, []);

  const iframeUrl = useMemo(() => {
    const base = (state.baseUrl || "").replace(/\/+$/, "");
    const path = state.path?.startsWith("/") ? state.path : `/${state.path || ""}`;
    if (!base) return "";
    return `${base}${path}`;
  }, [state.baseUrl, state.path]);

  const toggleCollapsed = () => setState(s => ({ ...s, collapsed: !s.collapsed }));
  const onChange = (k) => (e) => setState(s => ({ ...s, [k]: e.target.value }));

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("png")) { alert("Por favor sube un .png"); return; }
    const reader = new FileReader();
    reader.onload = () => setState(s => ({ ...s, clientLogoDataUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const saveVariables = async () => {
    console.log("Guardar variables:", {
      clientName: state.clientName,
      author: state.author,
      notes: state.notes,
      clientLogoDataUrl: !!state.clientLogoDataUrl,
    });
  };

  const refreshReport = () => {
    const iframe = document.getElementById("reports-iframe");
    if (!iframe || !iframe.src) return;
    try {
      const u = new URL(iframe.src, window.location.origin);
      u.hash = `ts=${Date.now()}`;
      iframe.src = u.toString();
    } catch {
      iframe.src = `${iframe.src.split("#")[0]}#ts=${Date.now()}`;
    }
  };

  const downloadPDF = () => {
    if (iframeUrl) window.open(iframeUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className={`reports-page minimal ${state.collapsed ? "is-collapsed" : ""}`}>
      {/* Botón flotante arriba-derecha */}
      <button
        className="reports-toggle top-right"
        type="button"
        aria-label={state.collapsed ? "Mostrar panel" : "Ocultar panel"}
        onClick={toggleCollapsed}
        title={state.collapsed ? "Mostrar panel" : "Ocultar panel"}
      >
        {state.collapsed ? (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm14.71-9.04a1.003 1.003 0 0 0 0-1.42l-2.5-2.5a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.99-1.66z"/>
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M9 6l6 6-6 6V6z"></path>
          </svg>
        )}
      </button>

      {/* IFRAME IZQ (70/30) */}
      <section className="reports-left">
        {!state.baseUrl ? (
          <div className="reports-empty">
            <h3>Configura un origen de reportes</h3>
            <p>
              Indica la <b>URL base</b> y la <b>ruta</b> de tu reporte (por ejemplo,
              tu contenedor <code>revealjs-report</code>).
            </p>
          </div>
        ) : (
          <iframe
            id="reports-iframe"
            className="reports-iframe"
            src={iframeUrl}
            title="Reporte embebido"
            loading="eager"
            referrerPolicy="no-referrer"
          />
        )}
      </section>

      {/* PANEL DERECHO (plegable) */}
      <aside className="reports-right" aria-hidden={state.collapsed}>
        <header className="reports-header">
          <h2>Variables del reporte</h2>
          <p className="sub">Estas variables se guardan en base de datos y se inyectan al generar el PDF.</p>
        </header>

        <div className="reports-form">
          <div className="row two">
            <div className="field">
              <label>Nombre del cliente</label>
              <input className="input" type="text" value={state.clientName} onChange={onChange("clientName")} />
            </div>
            <div className="field">
              <label>Autor</label>
              <input className="input" type="text" value={state.author} onChange={onChange("author")} />
            </div>
          </div>

          <div className="row">
            <label>Observaciones</label>
            <textarea className="input" rows={4} value={state.notes} onChange={onChange("notes")} />
          </div>

          <div className="row">
            <label>Logo del cliente (.png)</label>
            <input className="input" type="file" accept="image/png" onChange={onLogoChange} />
          </div>

          <div className="logo-preview">
            {state.clientLogoDataUrl ? (
              <img src={state.clientLogoDataUrl} alt="Logo cliente" />
            ) : (
              <div className="logo-placeholder">Previsualización del logo</div>
            )}
          </div>

          <div className="actions">
            <button className="btn ghost" onClick={saveVariables}>Guardar variables</button>
            <button className="btn ghost" onClick={refreshReport}>Actualizar reporte</button>
            <button className="btn brand" onClick={downloadPDF} disabled={!iframeUrl}>Descargar PDF</button>
          </div>
        </div>
      </aside>
    </div>
  );
}
