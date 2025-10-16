import React, { useState, useEffect } from 'react';
import api from '../api/axiosInstance';
import { apiError, confirm, loading, close, toastOk } from '../ui/alerts';
import './pagesStyles/RolesManager.css';

// Componente para un item de permiso editable
function EditablePermission({ permission, onSave, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(permission.name);

  const handleSave = async () => {
    if (name.trim() === permission.name) {
      setIsEditing(false);
      return;
    }
    await onSave(permission.id, name);
    setIsEditing(false);
  };

  const handleDelete = () => {
    onDelete(permission);
  };

  return (
    <div className="permission-item">
      {isEditing ? (
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus
        />
      ) : (
        <span>{permission.name}</span>
      )}
      <div className="permission-actions">
        <button onClick={() => setIsEditing(!isEditing)} title="Editar">{isEditing ? '...' : '✎'}</button>
        <button onClick={handleDelete} title="Eliminar">✕</button>
      </div>
    </div>
  );
}


export default function RolesManager() {
  const [roles, setRoles] = useState([]);
  const [allPermissions, setAllPermissions] = useState([]);
  const [selectedRole, setSelectedRole] = useState(null);
  const [permissionsForSelectedRole, setPermissionsForSelectedRole] = useState(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newPermissionName, setNewPermissionName] = useState('');

  async function fetchData() {
    setIsLoading(true);
    try {
      const [rolesRes, permissionsRes] = await Promise.all([
        api.get('/roles'),
        api.get('/roles/all-permissions'),
      ]);
      setRoles(rolesRes.data || []);
      setAllPermissions(permissionsRes.data || []);
    } catch (error) {
      apiError(error, 'No se pudieron cargar los datos');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setPermissionsForSelectedRole(new Set(role.permissions || []));
  };

  const handlePermissionToggle = (permissionId) => {
    const newSet = new Set(permissionsForSelectedRole);
    if (newSet.has(permissionId)) {
      newSet.delete(permissionId);
    } else {
      newSet.add(permissionId);
    }
    setPermissionsForSelectedRole(newSet);
  };

  const handleSavePermissions = async () => {
    if (!selectedRole) return;
    setIsSaving(true);
    loading('Guardando permisos...');
    try {
      await api.put(`/roles/${selectedRole.id}/permissions`, {
        permissionIds: Array.from(permissionsForSelectedRole),
      });
      const updatedRoles = roles.map(r => 
        r.id === selectedRole.id 
          ? { ...r, permissions: Array.from(permissionsForSelectedRole) }
          : r
      );
      setRoles(updatedRoles);
      close();
      toastOk('Permisos guardados');
    } catch (error) {
      close();
      apiError(error, 'No se pudieron guardar los permisos');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleCreateRole = async (e) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setIsSaving(true);
    loading('Creando rol...');
    try {
      const { data: newRole } = await api.post('/roles', { name: newRoleName });
      setRoles([...roles, newRole]);
      setNewRoleName('');
      close();
      toastOk('Rol creado con éxito');
    } catch (error) {
      close();
      apiError(error, 'No se pudo crear el rol');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleDeleteRole = async (role) => {
    if (role.id === 1 || role.id === 2) {
      return apiError(null, 'No puedes eliminar los roles base del sistema.');
    }
    const confirmation = await confirm('¿Eliminar Rol?', `Estás a punto de eliminar el rol "${role.name}". Esta acción no se puede deshacer.`);
    if (!confirmation.isConfirmed) return;
    
    loading('Eliminando rol...');
    try {
      await api.delete(`/roles/${role.id}`);
      setRoles(roles.filter(r => r.id !== role.id));
      if (selectedRole?.id === role.id) {
        setSelectedRole(null);
      }
      close();
      toastOk('Rol eliminado');
    } catch (error) {
      close();
      apiError(error, 'No se pudo eliminar el rol. Asegúrate de que no haya usuarios asignados a él.');
    }
  };

  // --- NUEVAS FUNCIONES PARA GESTIONAR PERMISOS GLOBALES ---

  const handleCreatePermission = async (e) => {
    e.preventDefault();
    if (!newPermissionName.trim()) return;
    
    loading('Creando permiso...');
    try {
        const { data: newPermission } = await api.post('/roles/permissions', { name: newPermissionName });
        setAllPermissions([...allPermissions, newPermission].sort((a,b) => a.name.localeCompare(b.name)));
        setNewPermissionName('');
        close();
        toastOk('Permiso creado');
    } catch (error) {
        close();
        apiError(error, 'No se pudo crear el permiso');
    }
  };

  const handleUpdatePermission = async (id, name) => {
    try {
        await api.put(`/roles/permissions/${id}`, { name });
        setAllPermissions(allPermissions.map(p => p.id === id ? { ...p, name } : p));
        toastOk('Permiso actualizado');
    } catch (error) {
        apiError(error, 'No se pudo actualizar el permiso');
    }
  };

  const handleDeletePermission = async (permission) => {
    const confirmation = await confirm('¿Eliminar Permiso?', `Se eliminará "${permission.name}". Esto lo quitará de todos los roles que lo usen.`);
    if (!confirmation.isConfirmed) return;

    loading('Eliminando permiso...');
    try {
        await api.delete(`/roles/permissions/${permission.id}`);
        setAllPermissions(allPermissions.filter(p => p.id !== permission.id));
        close();
        toastOk('Permiso eliminado');
    } catch (error) {
        close();
        apiError(error, 'No se pudo eliminar el permiso.');
    }
  };


  return (
    <div className="roles-manager-container">
      <div className="roles-list-panel">
        <h3>Roles</h3>
        {isLoading ? <p>Cargando...</p> : (
          <>
            <ul className="roles-list">
              {roles.map((role) => (
                <li
                  key={role.id}
                  className={selectedRole?.id === role.id ? 'selected' : ''}
                  onClick={() => handleSelectRole(role)}
                >
                  <span>{role.name}</span>
                  {(role.id !== 1 && role.id !== 2) && (
                    <button
                      className="delete-role-btn"
                      title={`Eliminar rol "${role.name}"`}
                      onClick={(e) => { e.stopPropagation(); handleDeleteRole(role); }}
                    >
                      ✕
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <form onSubmit={handleCreateRole} className="new-role-form">
              <input
                type="text"
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="Nombre del nuevo rol"
                disabled={isSaving}
              />
              <button type="submit" disabled={isSaving || !newRoleName.trim()}>
                Crear Rol
              </button>
            </form>
          </>
        )}
      </div>

      <div className="right-panels-container">
        <div className="permissions-panel">
          {selectedRole ? (
            <>
              <h3>Permisos para "{selectedRole.name}"</h3>
              <div className="permissions-grid">
                {allPermissions.map((permission) => (
                  <label key={permission.id} className="permission-label">
                    <input
                      type="checkbox"
                      checked={permissionsForSelectedRole.has(permission.id)}
                      onChange={() => handlePermissionToggle(permission.id)}
                      disabled={isSaving || selectedRole.id === 2}
                    />
                    {permission.name}
                  </label>
                ))}
              </div>
              <div className="actions">
                <button onClick={handleSavePermissions} disabled={isSaving || selectedRole.id === 2}>
                  {isSaving ? 'Guardando...' : 'Guardar Permisos'}
                </button>
                {selectedRole.id === 2 && <small className="muted">El rol de Admin tiene todos los permisos y no se puede modificar.</small>}
              </div>
            </>
          ) : (
            <div className="placeholder">
              <p>Selecciona un rol de la lista para ver y editar sus permisos.</p>
            </div>
          )}
        </div>

        {/* --- NUEVO PANEL DE GESTIÓN DE PERMISOS GLOBALES --- */}
        <div className="global-permissions-panel">
            <h3>Administrar Permisos Globales</h3>
            <div className="permissions-list">
                {allPermissions.map(p => (
                    <EditablePermission 
                        key={p.id} 
                        permission={p}
                        onSave={handleUpdatePermission}
                        onDelete={handleDeletePermission}
                    />
                ))}
            </div>
            <form onSubmit={handleCreatePermission} className="new-permission-form">
                <input 
                    type="text"
                    value={newPermissionName}
                    onChange={(e) => setNewPermissionName(e.target.value)}
                    placeholder="Nombre del nuevo permiso"
                />
                <button type="submit" disabled={!newPermissionName.trim()}>Crear Permiso</button>
            </form>
        </div>
      </div>
    </div>
  );
}