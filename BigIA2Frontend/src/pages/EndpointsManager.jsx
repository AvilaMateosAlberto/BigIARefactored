// src/pages/EndpointsManager.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axiosInstance";
import { useApp } from "../context/AppContext";
import IconPicker from "../components/IconPicker";
import "./pagesStyles/EndpointsManager.css";

const RESERVED = new Set([]); // si quieres reservar rutas, añádelas aquí

export default function EndpointsManager() {
  const { setMenu, permissions, user } = useApp?.() || { setMenu: () => {}, permissions: [], user: null };

  // --- Estado principal ---
  const [items, setItems] = useState([]);          // listado plano de menu_items
  const [selected, setSelected] = useState(null);  // fila seleccionada
  const [form, setForm] = useState({
    label: "",
    url: "",
    route: "",
    icon: "",
    permission_id: null,
    type: "link",        // 'link' | 'folder'
    parent_id: null,
    nivel_requerido: 1,  // si lo usas
    position: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routeError, setRouteError] = useState("");

  // --- Permisos mínimos (si no lo tienes en el backend, al menos oculta UI) ---
  const canManage = permissions?.includes?.("can_manage_endpoints") || true; // ponlo a true si aún no gestionas permisos en front

  // ========== CARGA ==========
  async function loadItems() {
    setLoading(true);
    try {
      const { data } = await api.get("/menu");
      setItems(data || []);
    } catch (e) {
      console.error("Error cargando menú:", e?.response?.data || e.message);
      alert(e?.response?.data?.error || "No se pudo cargar el listado");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadItems(); }, []);

  // Refrescar menú en el contexto (para que Sidebar muestre lo nuevo)
  async function refreshContextMenu() {
    try {
      const { data } = await api.get("/auth/me");
      setMenu?.(data.menu || []);
    } catch (e) {
      console.warn("No se pudo refrescar el menú del contexto:", e?.response?.data || e.message);
    }
  }

  // ========== MAPAS Y FLATTEN ==========
  const byParent = useMemo(() => {
    const map = new Map();
    for (const it of items) {
      const key = it.parent_id ?? null;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(it);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    return map;
  }, [items]);

  function flattenAll(parentId = null, depth = 0, acc = []) {
    const arr = byParent.get(parentId) || [];
    for (const it of arr) {
      const isFolder = it.type === "folder";
      acc.push({ ...it, __depth: depth, __isFolder: isFolder });
      if (isFolder) flattenAll(it.id, depth + 1, acc);
    }
    return acc;
  }

  const rows = useMemo(() => flattenAll(null, 0, []), [byParent]);

  const parentNameMap = useMemo(() => {
    const m = new Map();
    for (const it of items) m.set(it.id, it.label);
    return m;
  }, [items]);

  const allFolders = useMemo(() => rows.filter(r => r.__isFolder), [rows]);

  // ========== SELECT/FORM ==========
  function onSelect(row) {
    setSelected(row);
    if (row) {
      setForm({
        label: row.label || "",
        url: row.url || "",
        route: row.route || "",
        icon: row.icon || "",
        permission_id: row.permission_id ?? null,
        type: row.type || "link",
        parent_id: row.parent_id ?? null,
        nivel_requerido: row.nivel_requerido ?? 1,
        position: row.position ?? 0,
      });
      setRouteError("");
    } else {
      setForm({
        label: "",
        url: "",
        route: "",
        icon: "",
        permission_id: null,
        type: "link",
        parent_id: null,
        nivel_requerido: 1,
        position: 0,
      });
      setRouteError("");
    }
  }

  function normalizeRoute(r) {
    if (!r) return "";
    let v = String(r).trim();
    if (!v.startsWith("/")) v = "/" + v;
    return v.replace(/\/{2,}/g, "/");
  }

  const debounceTimer = useRef(null);
  function validateRoute(value, currentId) {
    const normalized = normalizeRoute(value);
    if (RESERVED.has(normalized)) {
      setRouteError(`La ruta "${normalized}" está reservada.`);
      return;
    }
    const dup = items.some(it => (it.route || "") === normalized && it.id !== currentId);
    if (dup) setRouteError(`La ruta "${normalized}" ya existe.`);
    else setRouteError("");
  }

  function handleChange(e) {
    const { name, value } = e.target;
    const next = { ...form, [name]: name === "nivel_requerido" ? Number(value) : value };

    if (name === "parent_id") next.parent_id = value === "" ? null : Number(value);
    if (name === "type" && value === "folder") { next.url = ""; next.route = ""; }

    setForm(next);

    if (name === "route" && next.type === "link") {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => validateRoute(next.route, selected?.id || null), 200);
    }
  }

  function isDescendant(candidateId, possibleAncestorId) {
    // ¿candidate es descendiente de ancestor?
    let p = parentIdOf(candidateId);
    while (p != null) {
      if (p === possibleAncestorId) return true;
      p = parentIdOf(p);
    }
    return false;
  }
  function parentIdOf(id) {
    const it = items.find(x => x.id === id);
    return it ? (it.parent_id ?? null) : null;
    }

  // ========== CRUD ==========
  async function save() {
    if (!form.label?.trim()) return alert('Falta "label"');
    if (form.type === "link" && !form.route?.trim()) return alert('Falta "route" para un link');
    if (routeError) return alert(routeError);

    const payload = {
      label: form.label.trim(),
      url: form.type === "folder" ? null : (form.url || null),
      route: form.type === "folder" ? null : normalizeRoute(form.route),
      icon: form.icon || null,
      permission_id: form.permission_id || null,
      type: form.type === "folder" ? "folder" : "link",
      parent_id: form.parent_id ?? null,
    };

    setSaving(true);
    try {
      if (selected?.id) {
        await api.put(`/menu/${selected.id}`, payload);
      } else {
        await api.post("/menu", payload);
      }
      await loadItems();
      await refreshContextMenu();
      alert("Guardado.");
      if (!selected?.id) onSelect(null);
    } catch (e) {
      console.error("Error guardando:", e?.response?.data || e.message);
      alert(e?.response?.data?.error || "Error guardando");
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected?.id) return;
    if (!confirm(`¿Eliminar "${selected.label}"?`)) return;
    try {
      await api.delete(`/menu/${selected.id}`);
      await loadItems();
      await refreshContextMenu();
      onSelect(null);
      alert("Eliminado.");
    } catch (e) {
      alert(e?.response?.data?.error || "No se pudo eliminar");
    }
  }

  async function recargarMenu() {
    await refreshContextMenu();
    alert("Menú recargado en la app.");
  }

  // ========== Drag & Drop ==========
  const [dragInfo, setDragInfo] = useState(null); // {id, __isFolder, parent_id}

  function onDragStartRow(row) {
    setDragInfo({ id: row.id, __isFolder: row.__isFolder, parent_id: row.parent_id ?? null });
  }
  function onDragOver(e) { e.preventDefault(); }

  const topLevel = useMemo(
    () => items.filter(i => i.parent_id == null).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [items]
  );

  function moveArrayBlockTopLevel(sourceId, targetId) {
    const order = [...topLevel];
    const si = order.findIndex(x => x.id === sourceId);
    const ti = order.findIndex(x => x.id === targetId);
    if (si < 0 || ti < 0) return order;
    const [moved] = order.splice(si, 1);
    order.splice(ti, 0, moved);
    return order.map((x, i) => ({ id: x.id, position: i }));
  }

  function onDropRow(targetRow) {
    if (!dragInfo) return;

    // 1) Arrastrando carpeta top-level → reordenar top-level
    if (dragInfo.__isFolder && dragInfo.parent_id == null && targetRow.parent_id == null) {
      const reTop = moveArrayBlockTopLevel(dragInfo.id, targetRow.id);
      const next = items.map(it => {
        if (it.parent_id == null) {
          const newer = reTop.find(x => x.id === it.id);
          if (newer) return { ...it, position: newer.position };
        }
        return it;
      });
      setItems(next);
      setDragInfo(null);
      return;
    }

    // 2) Arrastrando link dentro de la misma carpeta → reordenar dentro
    if (!dragInfo.__isFolder && dragInfo.parent_id === targetRow.parent_id) {
      const siblings = items
        .filter(x => (x.parent_id ?? null) === (targetRow.parent_id ?? null))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

      const si = siblings.findIndex(x => x.id === dragInfo.id);
      const ti = siblings.findIndex(x => x.id === targetRow.id);
      if (si < 0 || ti < 0) return setDragInfo(null);

      const newSibs = [...siblings];
      const [moved] = newSibs.splice(si, 1);
      newSibs.splice(ti, 0, moved);
      const reindexed = newSibs.map((x, i) => ({ id: x.id, position: i }));

      const next = items.map(it => {
        const newer = reindexed.find(x => x.id === it.id);
        return newer ? { ...it, position: newer.position } : it;
      });
      setItems(next);
      setDragInfo(null);
      return;
    }

    setDragInfo(null);
  }

  async function persistOrder() {
    try {
      // Construye payload con {id, position, parent_id} de TODOS
      const payload = items
        .slice()
        .sort((a, b) => (a.parent_id ?? 0) - (b.parent_id ?? 0) || (a.position ?? 0) - (b.position ?? 0))
        .map(it => ({ id: it.id, position: it.position ?? 0, parent_id: it.parent_id ?? null }));

      await api.put("/menu/reorder", { items: payload });
      await loadItems();
      await refreshContextMenu();
      alert("Orden guardado.");
    } catch (e) {
      console.error("Error guardando orden:", e?.response?.data || e.message);
      alert(e?.response?.data?.error || "No se pudo guardar el orden");
    }
  }

  if (!canManage) {
    return (
      <div className="endpoints-container">
        <div className="form-panel"><p>No tienes permisos para gestionar endpoints.</p></div>
      </div>
    );
  }

  return (
    <div className="endpoints-container">
      {/* LISTA */}
      <div className="list-panel">
        <div className="panel-header">
          <h2>Endpoints</h2>
          <div className="actions">
            <button onClick={() => onSelect(null)}>Nuevo</button>
            <button onClick={persistOrder}>Guardar orden</button>
            <button onClick={recargarMenu}>Recargar menú</button>
          </div>
        </div>

        {loading ? (
          <div className="table-wrap"><p>Cargando…</p></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}>⋮⋮</th>
                  <th>Label</th>
                  <th>Tipo</th>
                  <th>Carpeta</th>
                  <th>Ruta</th>
                  <th>Pos</th>
                  <th>Nivel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr
                    key={row.id}
                    className={[
                      selected?.id === row.id ? "selected" : "",
                      "draggable-row",
                      row.__isFolder ? "folder-row" : "link-row",
                      `depth-${Math.min(row.__depth, 6)}`
                    ].join(" ")}
                    onClick={() => onSelect(row)}
                    draggable
                    onDragStart={() => onDragStartRow(row)}
                    onDragOver={onDragOver}
                    onDrop={() => onDropRow(row)}
                  >
                    <td className="drag-handle" title="Arrastra para reordenar">⋮⋮</td>
                    <td className="label">
                      {row.__depth > 0 && <span className="indent-glyph">└─</span>}
                      {row.label}
                    </td>
                    <td>{row.type === "folder" ? "Carpeta" : "Link"}</td>
                    <td>{row.parent_id ? (parentNameMap.get(row.parent_id) ?? "—") : "—"}</td>
                    <td className="route-cell">{row.route ?? "—"}</td>
                    <td>{row.position}</td>
                    <td>{row.nivel_requerido}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* FORMULARIO */}
      <div className="form-panel">
        <div className="panel-header">
          <h2>{selected ? "Editar" : "Nuevo"}</h2>
          {selected?.id && (
            <div className="actions">
              <button className="btn-danger" onClick={removeSelected}>Eliminar</button>
            </div>
          )}
        </div>

        <div className="form-grid">
          <label>
            Label
            <input name="label" value={form.label} onChange={handleChange} placeholder="Nombre visible" />
          </label>

          <label>
            Tipo
            <select name="type" value={form.type} onChange={handleChange}>
              <option value="link">Link</option>
              <option value="folder">Carpeta</option>
            </select>
          </label>

          <label title="Ruta interna (para links). Se normaliza con / y sin dobles barras.">
            Ruta
            <input
              name="route"
              value={form.route}
              disabled={form.type === "folder"}
              onChange={handleChange}
              placeholder="/reports/incidencias"
            />
            {routeError && <small className="error">{routeError}</small>}
          </label>

          <label title="URL externa (opcional). Si pones URL, la ruta puede quedar vacía.">
            URL
            <input
              name="url"
              value={form.url}
              disabled={form.type === "folder"}
              onChange={handleChange}
              placeholder="https://… (opcional)"
            />
          </label>

          <label>
            Icono
            <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />
          </label>

          <label>
            Nivel requerido
            <select name="nivel_requerido" value={form.nivel_requerido} onChange={handleChange}>
              <option value={0}>0 (Todos)</option>
              <option value={1}>1 (User)</option>
              <option value={2}>2 (Admin)</option>
            </select>
          </label>

          <label title="Carpeta contenedora. El selector evita crear ciclos.">
            Carpeta
            <select name="parent_id" value={form.parent_id ?? ""} onChange={handleChange}>
              <option value="">(Top level)</option>
              {allFolders.map(f => {
                const disabled =
                  (selected?.id && (f.id === selected.id || isDescendant(f.id, selected.id)));
                const indent = "— ".repeat(f.__depth);
                return (
                  <option key={f.id} value={f.id} disabled={disabled}>
                    {indent}{f.label}
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
          <button onClick={() => onSelect(null)} disabled={saving}>Nuevo</button>
        </div>

        <div className="hint">
          <p><strong>Notas:</strong></p>
          <ul>
            <li>Puedes crear <b>carpetas dentro de carpetas</b>. El selector “Carpeta” evita ciclos.</li>
            <li>Las <b>rutas</b> se normalizan y el backend recalcula slugs/posiciones.</li>
            <li>Arrastra para reordenar (top-level como bloque y dentro de la misma carpeta); pulsa <b>Guardar orden</b>.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
