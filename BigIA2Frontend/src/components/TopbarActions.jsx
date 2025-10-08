// src/components/TopbarActions.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import IconResolver from "./IconResolver";
import "./componentsStyles/Topbar.css";

function applyTheme(next) {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  root.style.colorScheme = next;
  localStorage.setItem("pref_theme", next);
}

export default function TopbarActions() {
  const navigate = useNavigate();
  const { logout, user } = useApp();

  const getInitialTheme = () =>
    document.documentElement.getAttribute("data-theme") ||
    localStorage.getItem("pref_theme") ||
    "light";

  const [theme, setTheme] = React.useState(getInitialTheme);

  React.useEffect(() => {
    const obs = new MutationObserver(() => {
      const t = document.documentElement.getAttribute("data-theme");
      if (t && t !== theme) setTheme(t);
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    applyTheme(next);
    setTheme(next);
  };

  const doLogout = async () => {
    try { await logout(); } catch {}
    navigate("/login", { replace: true });
  };

  return (
  <div
    className="topbar-actions"
    style={{
      display: "flex",
      alignItems: "center",
      gap: "0.01rem", // separa pill / botones
    }}
  >
    {/* Pill de usuario */}
    <div
      className="user-pill"
      title={user?.username ?? ""}
    >
      {/* Icono del usuario */}
      <span className="user-icon" >
        <IconResolver name={user?.icon ?? "Person"} size={16} />
      </span>

      {/* Nombre del usuario */}
      <span className="user-name">{user?.username ?? "—"}</span>
    </div>

    {/* Botón de cambio de tema */}
    <button
      className="icon-btn"
      onClick={toggleTheme}
      title={`Cambiar a ${theme === "light" ? "oscuro" : "claro"}`}
    >
      <IconResolver name={theme === "light" ? "DarkMode" : "LightMode"} size={18} />
    </button>

    {/* Botón de logout */}
    <button
      className="icon-btn"
      onClick={doLogout}
      title="Salir"
    >
      <IconResolver name="logout" size={18} />
    </button>
  </div>
);

}
