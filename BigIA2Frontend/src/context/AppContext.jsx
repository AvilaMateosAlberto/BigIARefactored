// src/context/AppContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import api, { setAccessToken } from "../api/axiosInstance";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Evita doble ejecución del efecto en dev (StrictMode)
  const didRunRef = useRef(false);

  // Login: guarda user/menu/permissions y accessToken
  const login = (userData, menuData, permissionsData, token) => {
    setUser(userData || null);
    setMenu(menuData || []);
    setPermissions(permissionsData || []);
    setAccessToken(token || null);
  };

  // Logout: limpia estado y avisa al backend
  const logout = async () => {
    try { await api.post("/auth/logout"); } catch {}
    setAccessToken(null);
    setUser(null);
    setMenu([]);
    setPermissions([]);
  };

  // Auto-hidratación al montar: usa la cookie httpOnly de refresh
  useEffect(() => {
    // Evita doble ejecución en dev
    if (didRunRef.current) return;
    didRunRef.current = true;

    // Si estoy en /login, no intentes refrescar todavía para evitar 401 "ruidosos"
    if (window.location.pathname === "/login") {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const { data } = await api.post("/auth/refresh");
        // Estructura real: { accessToken, user, menu, permissions }
        const { accessToken, user, menu, permissions } = data;
        login(user, menu, permissions, accessToken);
      } catch {
        // Sin sesión; es normal si se entra por primera vez o expiró el refresh
        await logout();
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cierre global si el interceptor dispara sessionExpired
  useEffect(() => {
    const onExpired = () => logout();
    window.addEventListener("sessionExpired", onExpired);
    return () => window.removeEventListener("sessionExpired", onExpired);
  }, []);

  return (
    <AppContext.Provider
      value={{ user, menu, permissions, login, logout, loading, setMenu }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
