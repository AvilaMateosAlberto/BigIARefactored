// src/context/AppContext.jsx
import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import api, { setAccessToken } from "../api/axiosInstance";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const didRunRef = useRef(false);

  const login = (userData, menuData, permissionsData, token) => {
    setUser(userData || null);
    setMenu(menuData || []);
    setPermissions(permissionsData || []);
    setAccessToken(token || null);
  };

  const logout = useCallback(async () => {
    // No necesitamos llamar a la API aquí, porque al limpiar el estado, el usuario será redirigido.
    // La cookie del backend se invalidará en la siguiente petición o al cerrar el navegador.
    setAccessToken(null);
    setUser(null);
    setMenu([]);
    setPermissions([]);
  }, []);

  // Auto-hidratación al montar la app
  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const restoreSession = async () => {
      // --- LÓGICA CORREGIDA ---
      // Ya no usamos un try/catch agresivo.
      // Simplemente intentamos obtener los datos del usuario.
      // Si el token ha caducado, el interceptor de axios se encargará
      // de refrescarlo de forma silenciosa. Si el refresh falla,
      // el interceptor disparará 'sessionExpired' y el otro useEffect actuará.
      const { data } = await api.get("/auth/me");
      login(data.user, data.menu, data.permissions, localStorage.getItem("accessToken"));
    };

    restoreSession().finally(() => {
      setLoading(false);
    });
  }, []);

  // Cierre de sesión global cuando el refresh token muere.
  useEffect(() => {
    const onExpired = () => {
      console.log("Evento sessionExpired recibido, cerrando sesión.");
      logout();
    };
    window.addEventListener("sessionExpired", onExpired);
    return () => window.removeEventListener("sessionExpired", onExpired);
  }, [logout]);

  return (
    <AppContext.Provider
      value={{ user, menu, permissions, login, logout, loading, setMenu }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);