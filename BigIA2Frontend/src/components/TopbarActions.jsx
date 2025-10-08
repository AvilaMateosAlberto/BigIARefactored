// src/components/TopbarActions.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import IconResolver from "./IconResolver";

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
    <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span className="user-name" title={user?.username ?? ""}>
        {user?.username ?? "—"}
      </span>
      <button
        className="icon-btn"
        onClick={toggleTheme}
        title={`Cambiar a ${theme === "light" ? "oscuro" : "claro"}`}
        style={{ background: "transparent", border: 0, cursor: "pointer" }}
      >
        <IconResolver name={theme === "light" ? "moon" : "sun"} size={18} />
      </button>
      <button
        className="icon-btn"
        onClick={doLogout}
        title="Salir"
        style={{ background: "transparent", border: 0, cursor: "pointer" }}
      >
        <IconResolver name="logout" size={18} />
      </button>
    </div>
  );
}
