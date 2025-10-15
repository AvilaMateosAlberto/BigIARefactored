// src/pages/ReportPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import revealAxios from "../api/revealAxios";
import { useApp } from "../context/AppContext";
import "./pagesStyles/ReportPage.css";

const MAX_LOGO_SIZE = 1 * 1024 * 1024; // 1MB

// cache en módulo para no repetir pruebas
let hasCheckedPdfStatus = false;
let pdfStatusAvailable = false;

export default function ReportPage() {
  const { menu } = useApp();

  const reportItem = useMemo(() => {
    if (!Array.isArray(menu)) return null;
    const flatten = (arr, out = []) => {
      for (const n of arr) {
        if (n?.type === "folder" && Array.isArray(n.children)) flatten(n.children, out);
        else out.push(n);
      }
      return out;
    };
    const all = flatten(menu);
    return all.find((it) => it?.route === "/reportes") || null;
  }, [menu]);

  const [loadingInit, setLoadingInit] = useState(true);
  const [formOpen, setFormOpen] = useState(false); // empieza cerrado

  const [nombreCliente, setNombreCliente] = useState("");
  const [autor, setAutor] = useState("");
  const [observaciones, setObservaciones] = useState("");

  // Imagen del servidor (si existe) y selección local actual
  const [serverLogoUrl, setServerLogoUrl] = useState("");
  const [selectedLogoUrl, setSelectedLogoUrl] = useState(""); // blob de la selección
  const displayLogoUrl = selectedLogoUrl || serverLogoUrl;

  const [logoFile, setLogoFile] = useState(null);
  const fileRef = useRef(null);

  const [savingVars, setSavingVars] = useState(false);
  const [updatingReport, setUpdatingReport] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [refreshingIframe, setRefreshingIframe] = useState(false);

  const [copyingPdf, setCopyingPdf] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(null);

  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState("info");

  const baseIframeUrl = useMemo(() => {
    return reportItem?.url || reportItem?.iframe_url || "";
  }, [reportItem]);

  const [iframeNonce, setIframeNonce] = useState(0);
  const computedIframeSrc = useMemo(() => {
    if (!baseIframeUrl) return "";
    const sep = baseIframeUrl.includes("?") ? "&" : "?";
    return iframeNonce ? `${baseIframeUrl}${sep}_=${iframeNonce}` : baseIframeUrl;
  }, [baseIframeUrl, iframeNonce]);

  const refreshIframe = () => {
    if (!baseIframeUrl) return;
    setRefreshingIframe(true);
    setIframeNonce(Date.now());
    setTimeout(() => setRefreshingIframe(false), 600);
  };

  // Limpieza de blobs al desmontar
  useEffect(() => {
    return () => {
      if (serverLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(serverLogoUrl);
      if (selectedLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(selectedLogoUrl);
    };
  }, [serverLogoUrl, selectedLogoUrl]);

  // Carga inicial desde upstream
  useEffect(() => {
    let cancelled = false;

    async function loadClientInfo() {
      setLoadingInit(true);
      setMsg("");
      try {
        const { data } = await revealAxios.get("/get_client_info");
        const payload = data?.data ?? data;

        const nombre = payload?.Cliente ?? payload?.cliente ?? payload?.nombre_cliente ?? "";
        const autor_ = payload?.Autor ?? payload?.autor ?? "";
        const obs = payload?.Observaciones ?? payload?.observaciones ?? "";

        if (!cancelled) {
          setNombreCliente(String(nombre || ""));
          setAutor(String(autor_ || ""));
          setObservaciones(String(obs || ""));
        }

        // Logo (si tu upstream sirve esta ruta)
        try {
          const res = await revealAxios.get("/assets/logo_cliente.png", { responseType: "blob" });
          if (!cancelled) {
            const blobUrl = URL.createObjectURL(res.data);
            setServerLogoUrl((prev) => {
              if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
              return blobUrl;
            });
          }
        } catch {
          /* Es normal si el upstream no tiene logo aún */
        }
      } catch (err) {
        console.error("⚠️ get_client_info failed:", err);
        if (!cancelled) {
          setMsgType("error");
          setMsg("No se pudo cargar la información del cliente.");
        }
      } finally {
        if (!cancelled) setLoadingInit(false);
      }
    }

    loadClientInfo();
    return () => { cancelled = true; };
  }, []);

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) { setLogoFile(null); clearSelectedLogo(); return; }
    if (file.type !== "image/png") {
      setMsgType("error"); setMsg("El logo debe ser un archivo .png");
      fileRef.current && (fileRef.current.value = "");
      clearSelectedLogo();
      return;
    }
    if (file.size > MAX_LOGO_SIZE) {
      setMsgType("error"); setMsg("El logo es demasiado grande. Máximo 1MB.");
      fileRef.current && (fileRef.current.value = "");
      clearSelectedLogo();
      return;
    }
    const url = URL.createObjectURL(file);
    setSelectedLogoUrl((prev) => { if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev); return url; });
    setLogoFile(file);
  };

  const clearSelectedLogo = () => {
    // Vuelve a mostrar el del servidor automáticamente
    if (selectedLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(selectedLogoUrl);
    setSelectedLogoUrl("");
    setLogoFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  async function callGeneratePdfWithProgress() {
    setCopyingPdf(true);
    try {
      await revealAxios.post("/generate_pdf");
      setMsgType("success");
      setMsg("PDF regenerado correctamente.");
      return true;
    } catch (err) {
      console.error("❌ generate_pdf error:", err);
      setMsgType("error");
      setMsg(err?.response?.data?.error || err?.response?.data?.message || "No se pudo generar el PDF.");
      return false;
    } finally {
      if (pollTimer) clearInterval(pollTimer);
      setPdfProgress(null);
      setCopyingPdf(false);
    }
  }

  const handleSaveVariables = async (e) => {
    e.preventDefault();
    setSavingVars(true);
    setMsg("");

    try {
      // Siempre FormData (alineado con upstream)
      const form = new FormData();
      form.append("nombre_cliente", nombreCliente || "");
      form.append("autor", autor || "");
      form.append("observaciones", observaciones || "");
      if (logoFile) {
        form.append("logo_cliente", logoFile, "logo_cliente.png");
      }

      await revealAxios.post("/update_client_info", form);

      // Refrescar IFRAME ANTES del snapshot
      refreshIframe();

      const ok = await callGeneratePdfWithProgress();
      // Tras guardar, mantenemos la imagen seleccionada si existe.
      // Si quieres “congelar” la del servidor, puedes forzar clearSelectedLogo();

      if (ok) {
        setMsgType("success");
        setMsg("Variables guardadas y PDF regenerado correctamente.");
      }
    } catch (err) {
      console.error("❌ update_client_info error:", err);
      setMsgType("error");
      const serverMsg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        "No se pudieron guardar las variables.";
      setMsg(serverMsg);
    } finally {
      setSavingVars(false);
    }
  };

  const handleUpdateReport = async () => {
    setUpdatingReport(true);
    setMsg("");
    try {
      refreshIframe();
      await revealAxios.post("/generate_report");
      const ok = await callGeneratePdfWithProgress();
      if (ok) {
        setMsgType("success");
        setMsg("Reporte actualizado y PDF regenerado correctamente.");
      }
    } catch (err) {
      console.error("❌ generate_report error:", err);
      setMsgType("error");
      setMsg("No se pudo actualizar el reporte.");
    } finally {
      setUpdatingReport(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setMsg("");
    try {
      const res = await revealAxios.get("/download_report", { responseType: "blob" });
      const disp = res.headers?.["content-disposition"] || res.headers?.get?.("content-disposition") || "";
      let filename = "reporte.pdf";
      const m = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(disp);
      if (m && m[1]) filename = decodeURIComponent(m[1].replace(/\"/g, ""));
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      setMsgType("success"); setMsg("Descarga iniciada.");
    } catch (err) {
      console.error("❌ download_report error:", err);
      setMsgType("error"); setMsg("No se pudo descargar el PDF.");
    } finally {
      setDownloading(false);
    }
  };

  const iframeWidthClass = !baseIframeUrl ? "full" : formOpen ? "half" : "full";

  return (
    <div className="report-container">
      {/* FAB único: abre/cierra y cambia icono */}
      <div className="form-toggle-fab">
        <button
          type="button"
          className="fab"
          onClick={() => setFormOpen((v) => !v)}
          title={formOpen ? "Ocultar formulario" : "Mostrar formulario"}
          aria-label={formOpen ? "Ocultar formulario" : "Mostrar formulario"}
        >
          {formOpen ? "❯" : "✎"}
        </button>
      </div>

      {/* Iframe */}
      <section className={`iframe-section ${iframeWidthClass}`}>
        {baseIframeUrl ? (
          <>
            <iframe key={computedIframeSrc} src={computedIframeSrc} className="report-iframe" title="Reporte" />
            {(copyingPdf || refreshingIframe) && (
              <div className="loading-overlay">
                <div className="spinner" />
                <div className="loading-text">
                  {refreshingIframe ? "Actualizando vista…" : "Copiando reporte (PDF)…"}
                </div>
                {typeof pdfProgress === "number" && (
                  <div className="progress-wrap">
                    <progress value={pdfProgress} max="100" />
                    <span>{pdfProgress}%</span>
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="no-iframe">No hay URL configurada para /reportes.</div>
        )}
      </section>

      {/* Panel formulario */}
      <aside className={`form-section ${formOpen ? "open" : "closed"}`}>
        <div className="form-inner">
          <header className="form-header">
            <div className="form-header-row">
              <h2>Variables del reporte</h2>
            </div>
            <p className="muted">
              Estas variables se guardan en base de datos y se inyectan al generar el PDF.
            </p>
          </header>

          {msg && <div className={`inline-msg ${msgType}`}>{msg}</div>}

          <form className="client-form" onSubmit={handleSaveVariables}>
            <div className="form-grid">
              <div className="form-group">
                <label>
                  Nombre del cliente
                  <input
                    type="text"
                    value={nombreCliente}
                    onChange={(e) => setNombreCliente(e.target.value)}
                    disabled={loadingInit || savingVars || updatingReport}
                    autoComplete="off"
                    name="nombre_cliente"
                  />
                </label>
              </div>

              <div className="form-group">
                <label>
                  Autor
                  <input
                    type="text"
                    value={autor}
                    onChange={(e) => setAutor(e.target.value)}
                    disabled={loadingInit || savingVars || updatingReport}
                    autoComplete="off"
                    name="autor"
                  />
                </label>
              </div>

              <div className="form-group wide">
                <label>
                  Observaciones
                  <textarea
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    rows={4}
                    disabled={loadingInit || savingVars || updatingReport}
                    name="observaciones"
                  />
                </label>
              </div>

              {/* === LOGO: input arriba, preview debajo (ambos a ancho completo) === */}
              <div className="form-group wide">
                <label htmlFor="logo-input">Logo del cliente (.png)</label>
                <input
                  id="logo-input"
                  name="logo_cliente"
                  type="file"
                  accept="image/png"
                  onChange={onLogoChange}
                  ref={fileRef}
                  disabled={loadingInit || savingVars || updatingReport}
                />
              </div>

              <div className="form-group wide">
                <div className="logo-preview-wrap">
                  {displayLogoUrl ? (
                    <>
                      <img src={displayLogoUrl} alt="Logo del cliente" className="logo-preview" />
                      {selectedLogoUrl && (
                        <button
                          type="button"
                          className="clear-logo-btn"
                          title="Quitar selección"
                          aria-label="Quitar selección"
                          onClick={clearSelectedLogo}
                          disabled={savingVars || updatingReport}
                        >
                          ✕
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="logo-placeholder">Sin logo</div>
                  )}
                </div>
              </div>
            </div>

            <div className="form-actions">
              {/* Guardar y Actualizar ahora son secundarios */}
              <button
                type="submit"
                className="btn-secondary"
                disabled={savingVars || updatingReport}
                title="Guardar variables"
              >
                {savingVars ? "Guardando…" : "Guardar variables"}
              </button>

              <button
                type="button"
                className="btn-secondary"
                onClick={handleUpdateReport}
                disabled={updatingReport}
                title="Actualiza gráficos/datos"
              >
                {updatingReport ? "Actualizando…" : "Actualizar reporte"}
              </button>

              {/* Solo Descargar va con color principal */}
              <button
                type="button"
                className="btn-primary"
                onClick={handleDownload}
                disabled={downloading}
                title="Descarga el último PDF guardado"
              >
                {downloading ? "Descargando…" : "Descargar PDF"}
              </button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}
