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
    if (didRunRef.current) return;
    didRunRef.current = true;

    (async () => {
      const savedToken = localStorage.getItem("accessToken");

      try {
        // Si ya hay token, pruébalo directamente
        if (savedToken) {
          const { data } = await api.get("/auth/me");
          login(data.user, data.menu, data.permissions, savedToken);
        } else if (document.cookie.split(";").some((c) => c.trim().startsWith("rt="))) {
          const { data } = await api.post("/auth/refresh");
          const { accessToken, user, menu, permissions } = data;
          login(user, menu, permissions, accessToken);
        } 
      } catch {
        // Si falla, limpia todo
        await logout();
      } finally {
        setLoading(false);
      }
    })();
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
