// src/pages/LoginPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useConfig } from "../context/ConfigContext";
import api from "../api/axiosInstance";
import IconResolver from "../components/IconResolver";
import "./pagesStyles/LoginForm.css";

// 🔔 Importamos helpers centralizados
import {
  validatingCredentials,
  invalidCredentials,
  tooManyAttempts, // <-- Importamos la nueva alerta para el bloqueo
  close as closeAlert,
} from "../ui/alerts";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useApp();
  const { config } = useConfig();

  const var_title = config?.topbar_text || "BigIA 2.0";
  const login_title = config?.login_message || "Acceso a BigIA 2.0";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  
  // --- AÑADIDO: Nuevo estado para bloquear el formulario ---
  const [isLocked, setIsLocked] = useState(false);

  // Cierra el Swal si el usuario navega fuera del login
  useEffect(() => {
    return () => {
      try { closeAlert(); } catch {}
    };
  }, []);

  const togglePassword = () => setShowPassword((v) => !v);

  const submit = async (e) => {
    e.preventDefault();
    // --- AÑADIDO: No hacer nada si está bloqueado ---
    if (isLocked) return;
    setError("");

    try {
      // Mostrar modal de validación
      validatingCredentials();

      const res = await api.post("/auth/login", { username, password });
      const { accessToken, user, menu, permissions } = res.data;

      // Login correcto → cerrar modal y navegar
      closeAlert();
      login(user, menu, permissions, accessToken);
      navigate("/home", { replace: true });

    } catch (err) {
      console.error("Error login:", err?.response || err);

      // --- LÓGICA DE ERRORES MODIFICADA ---
      setTimeout(() => {
        try { closeAlert(); } catch {}

        // Caso 1: Error de "Demasiados Intentos" (429)
        if (err?.response?.status === 429) {
          const msg = err?.response?.data?.error || 'Demasiados intentos. Inténtelo más tarde.';
          setError(msg);
          setIsLocked(true); // Bloqueamos el formulario
          tooManyAttempts(msg); // Mostramos la alerta específica de bloqueo
        } else {
          // Caso 2: Cualquier otro error (ej. credenciales incorrectas)
          setError("Usuario o contraseña incorrectos");
          invalidCredentials();
        }
      }, 800);
    }
  };

  return (
    <div className="login-page">
      <header className="top-bar">
        <div className="topbar-inner">{var_title}</div>
      </header>

      <main className="login-container">
        <form onSubmit={submit} className="login-form">
          <div className="login-logo" aria-hidden="true" />
          <h2>{login_title}</h2>

          <div className="input-wrapper">
            <input
              name="username"
              value={username}
              placeholder="Usuario"
              autoFocus
              required
              onChange={(e) => setUsername(e.target.value)}
              // --- AÑADIDO: Deshabilitar si está bloqueado ---
              disabled={isLocked}
            />
          </div>

          <div className="input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              placeholder="Contraseña"
              required
              onChange={(e) => setPassword(e.target.value)}
              // --- AÑADIDO: Deshabilitar si está bloqueado ---
              disabled={isLocked}
            />
            <button
              type="button"
              className="eye-btn"
              onClick={togglePassword}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar" : "Mostrar"}
              // --- AÑADIDO: Deshabilitar si está bloqueado ---
              disabled={isLocked}
            >
              <IconResolver name={showPassword ? "visibility-off" : "visibility"} size={18} />
            </button>
          </div>

          <button type="submit" className="submit-btn" disabled={isLocked}>
            Entrar
          </button>

          {error && <p className="error">{error}</p>}
        </form>
      </main>
    </div>
  );
}