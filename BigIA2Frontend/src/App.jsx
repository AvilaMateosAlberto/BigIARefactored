// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import "./styles/themes.css";
import "./App.css";

import LoginForm from "./pages/LoginForm";
import Layout from "./components/Layout";
import DynamicRouteRenderer from "./pages/DynamicRouteRenderer";
import TopbarActions from "./components/TopbarActions";

import HomePage from "./pages/HomePage";
import SettingsPage from "./pages/SettingsPage";
import EndpointsManager from "./pages/EndpointsManager";

import IconResolver from "./components/IconResolver";
import { useApp } from "./context/AppContext";

/* ============== Tema ============== */
function applyTheme(next) {
  const root = document.documentElement;
  root.setAttribute("data-theme", next);
  root.style.colorScheme = next;
  localStorage.setItem("pref_theme", next);
}

/* ============== Guard de sesión con contexto ============== */
function RequireAuth({ children }) {
  const { user, loading } = useApp();
  if (loading) return null; // Aquí puedes poner un spinner si quieres
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

/* ============== Login wrapper (sin hacks; solo muestra el formulario) ============== */
function LoginLayout() {
  return (
    <div className="login-page">
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
  const { menu } = useApp();           // 👈 lee el menú real del contexto
  return (
    <Layout title="BigIA 2.0" menu={menu} rightSlot={<TopbarActions />}/>
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
