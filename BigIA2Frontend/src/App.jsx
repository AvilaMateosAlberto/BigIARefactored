// src/App.jsx
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./styles/themes.css";
import "./App.css";

import LoginForm from "./pages/LoginForm";
import Layout from "./components/Layout";
import DynamicRouteRenderer from "./pages/DynamicRouteRenderer";

// Páginas placeholder
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import EndpointsManager from "./pages/EndpointsManager";

// Iconos
import IconResolver from "./components/IconResolver";

/* ============== TopbarActions ============== */
function applyTheme(next) {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  root.style.colorScheme = next;
  localStorage.setItem("pref_theme", next);
}

function TopbarActions() {
  const navigate = useNavigate();

  // Tema inicial desde DOM o localStorage
  const getInitialTheme = () =>
    document.documentElement.getAttribute("data-theme") ||
    localStorage.getItem("pref_theme") ||
    "light";

  const [theme, setTheme] = useState(getInitialTheme);

  // Observa cambios externos en data-theme (por si otro script lo cambia)
  useEffect(() => {
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
    setTheme(next); // fuerza re-render del icono
  };

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button className="icon-btn" onClick={toggleTheme} title={`Cambiar a ${theme === "light" ? "oscuro" : "claro"}`} style={{ background:"transparent", border:0, cursor:"pointer" }}>
        <IconResolver name={theme === "light" ? "moon" : "sun"} size={18} />
      </button>
      <button className="icon-btn" onClick={logout} title="Salir" style={{ background:"transparent", border:0, cursor:"pointer" }}>
        <IconResolver name="logout" size={18} />
      </button>
    </div>
  );
}

/* ============== Menú demo ============== */
const demoMenu = [
  { id: "home", type: "page", label: "Inicio", route: "/home", icon: "home" },
  {
    id: "dash",
    type: "folder",
    label: "Dashboards",
    icon: "folder",
    children: [
      { id: "net", type: "page", label: "Red", route: "/dash/network", icon: "link" },
      { id: "sec", type: "page", label: "Seguridad", route: "/dash/security", badge: 12 },
      {
        id: "cloud",
        type: "folder",
        label: "Cloud",
        children: [
          { id: "az", type: "page", label: "Azure", route: "/dash/cloud/azure" },
          { id: "aws", type: "page", label: "AWS", route: "/dash/cloud/aws" },
          {
            id: "gcpf",
            type: "folder",
            label: "GCP",
            children: [
              { id: "gcp1", type: "page", label: "GKE", route: "/dash/cloud/gcp/gke" },
              { id: "gcp2", type: "page", label: "Logs", route: "/dash/cloud/gcp/logs" },
            ],
          },
        ],
      },
    ],
  },
  { id: "endp", type: "page", label: "Endpoints", route: "/endpoints", icon: "link" },
  { id: "settings", type: "page", label: "Ajustes", route: "/settings", icon: "cog" },
];

/* ============== Guard sencillo ============== */
function RequireAuth({ children }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/* ============== Login wrapper ============== */
function LoginLayout() {
  const navigate = useNavigate();

  const handleSubmitCapture = (e) => {
    if (e.type === "submit") {
      const form = e.target;
      const userInput = form.querySelector('input[name="username"]');
      const username = userInput ? userInput.value : "dev";
      localStorage.setItem("user", JSON.stringify({ username }));
      navigate("/home", { replace: true });
    }
  };

  return (
    <div className="login-page" onSubmitCapture={handleSubmitCapture}>
      <header className="top-bar">
        <div className="topbar-inner">BigIA 2.0</div>
      </header>
      <main className="login-container">
        <LoginForm />
      </main>
    </div>
  );
}

/* ============== AppShell ============== */
function AppShell() {
  return (
    <Layout title="BigIA 2.0" menu={demoMenu} rightSlot={<TopbarActions />}>
      {/* Layout renderiza <Outlet /> */}
    </Layout>
  );
}

/* ============== App ============== */
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginLayout />} />
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/endpoints" element={<EndpointsManager />} />
          <Route path="*" element={<DynamicRouteRenderer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
