// src/pages/UserManagement.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../api/axiosInstance";
import IconResolver from "../components/IconResolver";
import IconPicker from "../components/IconPicker";
import "./pagesStyles/UserManagement.css";

// 🔔 Alertas centralizadas
import {
  loading,
  close as closeAlert,
  confirmDeleteUser,
  created,
  updated,
  removed,
  toastInfo,
  apiError,
} from "../ui/alerts";

// === util opcional para evitar que "cargando..." se quede infinito ===
const sleeper = (ms) => new Promise((r) => setTimeout(r, ms));

async function tryGet(url) {
  try {
    const { data } = await api.get(url);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e?.response?.data?.error || e?.message || "error" };
  }
}

export default function UserManagement() {
  // listado + estados
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loadingState, setLoadingState] = useState(true);
  const [err, setErr] = useState("");

  // form
  const empty = { id: null, username: "", password: "", role_id: "", icon: "" };
  const [form, setForm] = useState(empty);
  const isEditing = form.id !== null;

  // === CARGA INICIAL (nunca “se cuelga”) ===
  useEffect(() => {
    let cancel = false;
    (async () => {
      setLoadingState(true);
      setErr("");

      // hacemos dos peticiones en paralelo; aunque falle roles, seguimos
      const [uRes, rRes] = await Promise.allSettled([tryGet("/users"), tryGet("/users/roles")]);
      if (cancel) return;

      // users
      if (uRes.status === "fulfilled" && uRes.value.ok && Array.isArray(uRes.value.data)) {
        setUsers(uRes.value.data);
      } else {
        const msg =
          (uRes.status === "fulfilled" ? uRes.value.error : uRes.reason) ||
          "No se pudieron cargar los usuarios.";
        setErr(String(msg));
        setUsers([]);
      }

      // roles: si falla, simplemente no mostramos el select y avisamos
      if (rRes.status === "fulfilled" && rRes.value.ok && Array.isArray(rRes.value.data)) {
        setRoles(rRes.value.data);
      } else {
        const msg =
          (rRes.status === "fulfilled" ? rRes.value.error : rRes.reason) ||
          "No se pudieron cargar los roles.";
        setErr((prev) => prev ? `${prev} · ${String(msg)}` : String(msg));
        setRoles([]);
      }

      // pequeño respiro para evitar parpadeos de UI
      await sleeper(150);
      if (!cancel) setLoadingState(false);
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
    if (!form.icon) {
      setErr("Selecciona un icono.");
      return;
    }

    try {
      loading(isEditing ? "Guardando usuario…" : "Creando usuario…");

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
        await reload(false); // recarga silenciosa
        closeAlert();
        updated("Usuario actualizado");
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
        await reload(false);
        closeAlert();
        created("Usuario creado");
      }
    } catch (e2) {
      closeAlert();
      setErr(e2?.response?.data?.error || "No se pudo guardar el usuario.");
      apiError(e2, "No se pudo guardar el usuario");
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
    const c = await confirmDeleteUser(u.username);
    if (!c.isConfirmed) return;

    try {
      loading("Eliminando usuario…");
      await api.delete(`/users/${u.id}`);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      if (form.id === u.id) reset();
      closeAlert();
      removed("Usuario eliminado");
    } catch (e2) {
      closeAlert();
      setErr(e2?.response?.data?.error || "No se pudo borrar el usuario.");
      apiError(e2, "No se pudo borrar el usuario");
    }
  }

  async function reload(showToast = true) {
    setErr(""); // limpiamos errores, pero no tocamos loading
    try {
      const [{ data: u }, { data: r }] = await Promise.all([
        api.get("/users"),
        api.get("/users/roles"),
      ]);
      setUsers(u || []);
      setRoles(r || []);
      if (showToast) toastInfo("Listado actualizado");
    } catch (e2) {
      setErr(e2?.response?.data?.error || "No se pudo recargar.");
      apiError(e2, "No se pudo recargar");
    }
  }

  // === RENDER ===
  if (loadingState) {
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
            <button className="btn btn-small" onClick={() => reload()} style={{ marginLeft: 8 }}>
              Reintentar
            </button>
          </div>
        )}

        <h2 className="users-form-title">
          {isEditing ? "Editar usuario" : "Crear nuevo usuario"}
        </h2>

        <form onSubmit={submit} className="users-form grid-2col">
          <label>
            <span>Nombre</span>
            <input
              className="input"
              name="username"
              value={form.username}
              onChange={onChange}
              placeholder="Username"
            />
          </label>

          <label>
            <span>Contraseña</span>
            <input
              className="input"
              name="password"
              type="password"
              value={form.password}
              onChange={onChange}
              placeholder={isEditing ? "Nueva contraseña (opcional)" : "Password"}
              autoComplete="new-password"
            />
          </label>

          <label>
            <span>Rol</span>
            {rolesEmpty ? (
              <select className="input" disabled value="">
                <option value="">(sin roles)</option>
              </select>
            ) : (
              <select
                className="input"
                name="role_id"
                value={form.role_id}
                onChange={onChange}
              >
                <option value="" disabled>
                  Seleccionar rol...
                </option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
          </label>

          <label>
            <span>Icono</span>
            <IconPicker
              value={form.icon}
              placeholder="Person"
              onChange={(v) => setForm({ ...form, icon: v })}
            />
          </label>

          <div className="form-actions">
            <button className="btn btn-success" type="submit">
              {isEditing ? "Guardar" : "Crear"}
            </button>

            {isEditing && (
              <button className="btn btn-danger" type="button" onClick={reset}>
                Cancelar
              </button>
            )}

            {/* <button className="btn" type="button" onClick={() => reload()}>
              <IconResolver name={"Cached"} size={18} />
            </button> */}
          </div>
        </form>

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
                  <td>{u.role_name || "—"}</td>
                  <td>{u.icon ? <IconResolver name={u.icon} size={18} /> : "—"}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="btn btn-small" onClick={() => edit(u)}>
                        Editar
                      </button>
                      {u.username !== "admin" && (
                        <button
                          className="btn btn-small btn-danger"
                          onClick={() => del(u)}
                        >
                          Borrar
                        </button>
                      )}
                    </div>
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
    </div>
  );
}
