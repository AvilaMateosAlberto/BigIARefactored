import { createContext, useContext, useState } from "react";

const AppContext = createContext();
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }) {
  const [user, setUser] = useState({ name: "Admin", role: "admin" });
  const [menu, setMenu] = useState([
    { id: 1, label: "Dashboards", route: "/dashboards", icon: "home", url: "https://example.com" },
    { id: 2, label: "Reportes", route: "/reportes", icon: "barchart", url: "https://example.com" },
    { id: 3, label: "Usuarios", route: "/usuarios", icon: "users" },
  ]);
  const [config, setConfig] = useState({ title: "BigIA 2.0", brand: "#c40000" });

  return (
    <AppContext.Provider value={{ user, menu, config }}>
      {children}
    </AppContext.Provider>
  );
}
