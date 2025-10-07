// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./styles/themes.css";
import "./App.css";

import LoginForm from "./pages/LoginForm";
import Layout from "./components/Layout";       // tus componentes
import Topbar from "./components/Topbar";       // (Layout ya lo usa)
import Sidebar from "./components/Sidebar";     // (Layout ya lo usa)
import DynamicRouteRenderer from "./pages/DynamicRouteRenderer";

// Páginas placeholder (creadas más abajo)
import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import EndpointsManager from "./pages/EndpointsManager";

// --- Topbar actions (toggle tema + user + logout) ---
import IconResolver from "./components/IconResolver";
import { setTheme } from "./utils/themeClient";       // si aún no lo tienes, puedes quitar esto
// Si no tienes themeClient todavía, comenta la línea de setTheme y cambia toggleTheme a sólo localStorage.

function TopbarActions() {
  const navigate = useNavigate();
  const pref = (localStorage.getItem("pref_theme") || "light");

  const toggleTheme = () => {
    const next = pref === "light" ? "dark" : "light";
    try { setTheme(next); } catch {}
    localStorage.setItem("pref_theme", next);
    // fuerza un repaint rápido
    const root = document.documentElement;
    root.setAttribute("data-theme", next);
    root.style.colorScheme = next;
  };

  const logout = () => {
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <button className="icon-btn" onClick={toggleTheme} title="Cambiar tema" style={{ background:"transparent", border:0, cursor:"pointer" }}>
        <IconResolver name={pref === "light" ? "moon" : "sun"} size={18} />
      </button>
      <span aria-label="Usuario" title="Usuario"><IconResolver name="user" size={18} /></span>
      <button className="icon-btn" onClick={logout} title="Salir" style={{ background:"transparent", border:0, cursor:"pointer" }}>
        <IconResolver name="logout" size={18} />
      </button>
    </div>
  );
}

// --- Menú demo mientras llega el backend ---
const demoMenu = [
  { id: 1, label: "Inicio", route: "/home", icon: "home" },
  { id: 2, label: "Endpoints", route: "/endpoints", icon: "link" },
  { id: 3, label: "Ajustes", route: "/settings", icon: "cog" },
  // Ejemplo externo para probar DynamicRouteRenderer cuando uses menú con url:
  // { id: 4, label: "Kibana", route: "/kibana", icon: "link", url: "https://tuservidor/kibana" },
];

// --- Guard muy simple con localStorage ---
function RequireAuth({ children }) {
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// --- LoginLayout: envuelve TU LoginForm y captura el submit (sin tocar LoginForm) ---
function LoginLayout() {
  const navigate = useNavigate();

  const handleSubmitCapture = (e) => {
    // Si el hijo hace preventDefault, el submit sigue propagando.
    if (e.type === "submit") {
      // demo login: guardamos usuario y navegamos
      const form = e.target;
      // opcional: leer el username del input para simular usuario
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

// --- AppShell: usa tu Layout con Topbar/Sidebar y acciones a la derecha ---
function AppShell() {
  return (
    <Layout title="BigIA 2.0" menu={demoMenu} rightSlot={<TopbarActions />}>
      {/* Layout renderiza <Outlet />, las rutas están abajo */}
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login público (tu UI intacta) */}
        <Route path="/login" element={<LoginLayout />} />

        {/* App protegida */}
        <Route element={<RequireAuth><AppShell /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/endpoints" element={<EndpointsManager />} />
          {/* Cualquier otra ruta: si en el menú existe y tiene url, la resolverá DynamicRouteRenderer */}
          <Route path="*" element={<DynamicRouteRenderer />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
