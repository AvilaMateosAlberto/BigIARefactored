import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axiosInstance";
import "./pagesStyles/UserManagement.css"; // opcional; si no lo tienes, no pasa nada

// === util opcional para evitar que "cargando..." se quede infinito ===
const sleeper = (ms) => new Promise((r) => setTimeout(r, ms));

async function tryGet(url) {
  try {
    const { data } = await api.get(url);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.response?.data || e?.message || "error" };
  }
}

// prueba varias rutas de roles; si no hay roles, seguimos igual (el UI avisa)
async function fetchRolesResilient() {
  const candidates = ["/roles", "/users/roles", "/auth/roles"];
  for (const url of candidates) {
    const r = await tryGet(url);
    if (r.ok && Array.isArray(r.data)) return r.data;
  }
  return [];
}

export default function UserManagement() {
  // listado + estados
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // form
  const empty = { id: null, username: "", password: "", role_id: "", icon: "" };
  const [form, setForm] = useState(empty);
  const isEditing = form.id !== null;

  // mapa roles para pintar nombre
  const rolesById = useMemo(() => {
    const m = new Map();
    roles.forEach((r) => m.set(r.id, r));
    return m;
  }, [roles]);

  // === CARGA INICIAL (nunca “se cuelga”) ===
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoading(true);
      setErr("");
      // hacemos dos peticiones en paralelo; aunque falle roles, seguimos
      const [uRes, rList] = await Promise.allSettled([tryGet("/users"), fetchRolesResilient()]);
      if (cancel) return;

      // users
      if (uRes.status === "fulfilled" && uRes.value.ok && Array.isArray(uRes.value.data)) {
        setUsers(uRes.value.data);
      } else {
        const msg =
          (uRes.status === "fulfilled" ? uRes.value.error : uRes.reason) || "No se pudieron cargar los usuarios.";
        setErr(String(msg));
        setUsers([]);
      }

      // roles: si falla, simplemente no mostramos el select y avisamos
      if (rList.status === "fulfilled" && Array.isArray(rList.value)) {
        setRoles(rList.value);
      } else {
        setRoles([]);
      }

      // pequeño respiro para evitar parpadeos de UI
      await sleeper(150);
      if (!cancel) setLoading(false);
    })();

    return () => {
      cancel = true;
    };
  }, []);

  // === UI helpers ===
  function onChange(e) {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  }
  function reset() {
    setForm(empty);
  }

  // === CRUD ===
  async function submit(e) {
    e.preventDefault();
    setErr("");
    if (!form.username || (!isEditing && !form.password)) {
      setErr("Rellena usuario y contraseña (si creas).");
      return;
    }
    if (roles.length > 0 && !form.role_id) {
      setErr("Selecciona un rol.");
      return;
    }

    try {
      if (isEditing) {
        const payload = {
          username: form.username,
          icon: form.icon || null,
          ...(form.password ? { password: form.password } : {}),
          ...(form.role_id ? { role_id: Number(form.role_id) } : {}),
        };
        const { data } = await api.put(`/users/${form.id}`, payload);
        setUsers((prev) => prev.map((u) => (u.id === data.id ? { ...u, ...data } : u)));
        reset();
      } else {
        const payload = {
          username: form.username,
          password: form.password,
          icon: form.icon || null,
          ...(form.role_id ? { role_id: Number(form.role_id) } : {}),
        };
        const { data } = await api.post("/users", payload);
        setUsers((prev) => [...prev, data]);
        reset();
      }
    } catch (e2) {
      setErr(e2?.response?.data?.error || "No se pudo guardar el usuario.");
    }
  }

  async function edit(u) {
    setErr("");
    setForm({
      id: u.id,
      username: u.username,
      password: "",
      role_id: u.role_id ? String(u.role_id) : "",
      icon: u.icon || "",
    });
    // scroll suave al formulario
    document.querySelector(".user-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function del(u) {
    setErr("");
    if (!confirm(`¿Borrar usuario ${u.username}?`)) return;
    try {
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      if (form.id === u.id) reset();
    } catch (e2) {
      setErr(e2?.response?.data?.error || "No se pudo borrar el usuario.");
    }
  }

  async function reload() {
    // botoncito por si quieres recargar sin F5
    setLoading(true);
    setErr("");
    try {
      const [{ data: u }, r] = await Promise.all([api.get("/users"), fetchRolesResilient()]);
      setUsers(u || []);
      setRoles(r || []);
    } catch (e2) {
      setErr(e2?.response?.data?.error || "No se pudo recargar.");
    } finally {
      setLoading(false);
    }
  }

  // === RENDER ===
  if (loading) {
    return (
      <div className="users-page">
        <div className="users-card">Cargando usuarios…</div>
      </div>
    );
  }

  const rolesEmpty = roles.length === 0;

  return (
    <div className="users-page">
      <h1 className="users-title">Gestión de usuarios</h1>

      <div className="users-card user-form">
        {err && (
          <div className="alert">
            {String(err)}
            <button className="btn btn-small" onClick={reload} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        )}

        <form onSubmit={submit} className="users-grid">
          <div className="f f--left">
            <label>Usuario</label>
            <input
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder="usuario"
              autoComplete="off"
            />
          </div>

          <div className="f f--right">
            <label>Contraseña {isEditing && <small>(opcional)</small>}</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder={isEditing ? "dejar en blanco para no cambiar" : "••••••••"}
              autoComplete="new-password"
            />
          </div>

          {/* Si tenemos roles del backend, muestra el select; si no, avisa pero deja crear si el backend no exige role_id */}
          <div className="f f--left">
            <label>Rol</label>
            {rolesEmpty ? (
              <>
                <div className="hint">No se han podido cargar roles (seguirás pudiendo crear si el backend no los exige).</div>
                <select disabled value="">
                  <option value="">(sin roles)</option>
                </select>
              </>
            ) : (
              <select name="role_id" value={form.role_id} onChange={onChange}>
                <option value="">Selecciona un rol…</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="f f--right">
            <label>Icono (opcional)</label>
            <input
              name="icon"
              value={form.icon}
              onChange={onChange}
              placeholder="User, Shield, ..."
            />
          </div>

          <div className="actions">
            <button className="btn btn-primary" type="submit">
              {isEditing ? "Guardar cambios" : "Crear usuario"}
            </button>
            {isEditing && (
              <button className="btn" type="button" onClick={reset}>
                Cancelar
              </button>
            )}
            <button className="btn" type="button" onClick={reload}>
              Recargar
            </button>
          </div>
        </form>
      </div>

      <div className="users-card">
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Icono</th>
              <th style={{ width: 160 }}></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{rolesById.get(u.role_id)?.name || u.role_name || u.role_id || "—"}</td>
                <td>{u.icon || "—"}</td>
                <td>
                  <button className="btn btn-small" onClick={() => edit(u)}>
                    Editar
                  </button>
                  <button className="btn btn-small btn-danger" onClick={() => del(u)}>
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", opacity: 0.7 }}>
                  No hay usuarios.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
