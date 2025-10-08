// src/context/AppContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import api, { setAccessToken } from "../api/axiosInstance";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [menu, setMenu] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true); // para mostrar spinner si quieres

  // Login: guarda user/menu/permissions y accessToken
  const login = (userData, menuData, permissionsData, token) => {
    setUser(userData);
    setMenu(menuData || []);
    setPermissions(permissionsData || []);
    setAccessToken(token || null);
  };

  // Logout: limpia todo
  const logout = () => {
    setUser(null);
    setMenu([]);
    setPermissions([]);
    setAccessToken(null);
  };

  // Auto-hidratación al montar: refresh token
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.post("/auth/refresh"); // backend envía cookie refresh
        const { accessToken, user, menu, permissions } = data.body;
        login(user, menu, permissions, accessToken);
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppContext.Provider
      value={{ user, menu, permissions, login, logout, loading }}
    >
      {children}
    </AppContext.Provider>
  );
}

// Hook para usar el contexto
export const useApp = () => useContext(AppContext);
