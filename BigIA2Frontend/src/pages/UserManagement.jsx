// src/pages/UserManagement.jsx
import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axiosInstance';

// NOTA CSS:
// Este componente usa las clases que me pasaste (endpoints-container, list-panel, form-panel, etc.).
// Asegúrate de tener ese CSS importado globalmente (por ejemplo en App.css)
// o crea un archivo UserManagement.css con ese contenido y haz import './UserManagement.css';

export default function UserManagement() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [error, setError] = useState(null);

  // Roles desde BBDD (GET /roles) con fallback si no existe
  const [roles, setRoles] = useState([]); // [{id, name}]
  const [rolesError, setRolesError] = useState(null);

  // Form SIN email (según tu esquema)
  const [form, setForm] = useState({
    username: '',
    password: '',
    role_id: null,   // id de tabla roles
    icon: '',        // opcional (tu esquema lo soporta)
  });

  const canCreate = useMemo(
    () => form.username.trim() && form.password.trim() && (form.role_id != null),
    [form]
  );

  // Utilidad: mapa id->name para pintar rol por nombre
  const roleNameById = useMemo(() => {
    const m = new Map();
    roles.forEach(r => m.set(r.id, r.name));
    return m;
  }, [roles]);

  async function loadUsers() {
    try {
      setLoading(true);
      setError(null);
      const { data } = await api.get('/users'); // tu GET ya funciona (devuelve admin)
      const rows = Array.isArray(data) ? data : (data?.users || []);
      setList(rows);
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo cargar la lista de usuarios');
      setList([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRoles() {
    try {
      setRolesError(null);
      const { data } = await api.get('/roles'); // si no existe, usa fallback
      const rows = Array.isArray(data) ? data : (data?.roles || []);
      const normalized = rows
        .map(r => ({ id: r.id ?? r.role_id ?? null, name: r.name ?? r.role_name ?? '' }))
        .filter(r => r.id != null && r.name);
      if (normalized.length) {
        setRoles(normalized);
        // Por defecto, si existe 'user' lo seleccionamos, si no el primero
        const def = normalized.find(r => r.name === 'user') || normalized[0];
        setForm(f => ({ ...f, role_id: def?.id ?? null }));
        return;
      }
      throw new Error('Respuesta /roles vacía');
    } catch (_) {
      // FALLBACK a lo que tienes en init.sql
      const fallback = [
        { id: 1, name: 'user' },
        { id: 2, name: 'admin' },
      ];
      setRoles(fallback);
      setForm(f => ({ ...f, role_id: 1 })); // user por defecto
      setRolesError('No se pudo cargar /roles. Usando valores por defecto (user/admin).');
    }
  }

  async function createUser(e) {
    e?.preventDefault?.();
    if (!canCreate) return;
    try {
      setError(null);
      const payload = {
        username: form.username.trim(),
        password: form.password,
        role_id: form.role_id,     // ajustado a tu esquema
        icon: form.icon?.trim() || null,
      };
      await api.post('/users', payload);
      // Limpio username/password pero mantengo rol y icon
      setForm(f => ({ ...f, username: '', password: '' }));
      await loadUsers();
    } catch (e2) {
      setError(e2?.response?.data?.error || 'No se pudo crear el usuario');
    }
  }

  async function removeUser(id) {
    if (!id) return;
    const ok = window.confirm('¿Eliminar este usuario?');
    if (!ok) return;
    try {
      setError(null);
      await api.delete(`/users/${id}`); // <-- corregido el template string
      await loadUsers();
    } catch (e) {
      setError(e?.response?.data?.error || 'No se pudo eliminar el usuario');
    }
  }

  useEffect(() => {
    // Cargamos roles y usuarios en paralelo
    Promise.all([loadRoles(), loadUsers()]).catch(() => {});
  }, []);

  return (
    <div className="endpoints-container">
      {/* LISTA */}
      <section className="list-panel">
        <div className="panel-header">
          <h2>Usuarios</h2>
          <div className="panel-actions">
            <button onClick={loadUsers}>Recargar</button>
          </div>
        </div>

        {rolesError && (
          <div style={{ color: 'goldenrod', marginBottom: 8 }}>{rolesError}</div>
        )}
        {error && (
          <div style={{ color: 'tomato', marginBottom: 8 }}>{error}</div>
        )}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th className="label">Usuario</th>
                <th>Rol</th>
                <th>Icono</th>
                <th style={{ width: 140 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 12 }}>Cargando…</td></tr>
              ) : list.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 12 }}>Sin usuarios</td></tr>
              ) : (
                list.map(u => {
                  // nombre del rol: si el backend lo da por nombre, úsalo; si no, resuelve por role_id
                  const roleShown =
                    u.role_name || u.role || roleNameById.get(u.role_id) || u.role_id || '—';
                  return (
                    <tr key={u.id ?? u.username}>
                      <td className="label">{u.username}</td>
                      <td>{roleShown}</td>
                      <td>{u.icon || '—'}</td>
                      <td>
                        <button className="btn-danger" onClick={() => removeUser(u.id)}>
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* FORM */}
      <section className="form-panel">
        <div className="panel-header">
          <h2>Crear usuario</h2>
        </div>

        <form onSubmit={createUser}>
          <div className="form-grid">
            <label>
              Usuario
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin, juanperez…"
                autoComplete="off"
              />
            </label>

            <label>
              Rol
              <select
                value={form.role_id ?? ''}
                onChange={e => setForm(f => ({ ...f, role_id: Number(e.target.value) }))}
              >
                {roles.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>

            <label>
              Contraseña
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </label>

            <label>
              Icono (opcional)
              <input
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                placeholder="Nombre del icono o URL/SVG"
              />
            </label>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={!canCreate}>
              Crear
            </button>
            <button type="button" className="btn-secondary" onClick={() => setForm(f => ({ ...f, username: '', password: '' }))}>
              Limpiar
            </button>
          </div>

          <div className="hint">
            Consejo: los roles vienen de la tabla <code>roles</code>.
            Si tu backend no expone <code>GET /roles</code> aún, el componente usa un fallback
            (<code>user/admin</code>) basado en tu <code>init.sql</code>.
          </div>
        </form>
      </section>
    </div>
  );
}
