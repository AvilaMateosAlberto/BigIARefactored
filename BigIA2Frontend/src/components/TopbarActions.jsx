// src/components/TopbarActions.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import IconResolver from "./IconResolver";
import "./componentsStyles/Topbar.css";

// 🔔 Importamos los helpers centralizados
import { confirm, err } from "../ui/alerts";

function applyTheme(next) {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  root.style.colorScheme = next;
  localStorage.setItem("pref_theme", next);
}

export default function TopbarActions() {
  const navigate = useNavigate();
  const { logout, user } = useApp();

  // Estado y detección del tema actual
  const getInitialTheme = () =>
    document.documentElement.getAttribute("data-theme") ||
    localStorage.getItem("pref_theme") ||
    "light";

  const [theme, setTheme] = React.useState(getInitialTheme);

  // Observa cambios externos del tema (por ejemplo, cambio manual o restauración)
  React.useEffect(() => {
    const obs = new MutationObserver(() => {
      const t = document.documentElement.getAttribute("data-theme");
      if (t && t !== theme) setTheme(t);
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => obs.disconnect();
  }, [theme]);

  // Cambiar entre modo claro/oscuro
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  };

  // Cerrar sesión real
  const doLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Error al cerrar sesión:", e);
      err("Error", "No se pudo cerrar la sesión correctamente");
    } finally {
      navigate("/login", { replace: true });
    }
  };

  // Confirmación con alertas centralizadas
  const confirmLogout = async () => {
    const res = await confirm("¿Cerrar sesión?", "Se cerrará tu sesión actual.", "Sí, cerrar sesión");
    if (res.isConfirmed) doLogout();
  };

  return (
    <div
      className="topbar-actions"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.01rem",
      }}
    >
      {/* Pill de usuario */}
      <div className="user-pill" title={user?.username ?? ""}>
        <span className="user-icon">
          <IconResolver name={user?.icon ?? "Person"} size={16} />
        </span>
        <span className="user-name">{user?.username ?? "—"}</span>
      </div>

      {/* Botón de cambio de tema */}
      <button
        className="icon-btn"
        onClick={toggleTheme}
        title={`Cambiar a ${theme === "light" ? "oscuro" : "claro"}`}
      >
        <IconResolver
          name={theme === "light" ? "DarkMode" : "LightMode"}
          size={18}
        />
      </button>

      {/* Botón de logout con confirmación */}
      <button
        className="icon-btn"
        onClick={confirmLogout}
        title="Cerrar sesión"
      >
        <IconResolver name="logout" size={18} />
      </button>
    </div>
  );
}
