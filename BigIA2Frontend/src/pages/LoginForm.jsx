// src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import api from "../api/axiosInstance";
import IconResolver from "../components/IconResolver";
import "./pagesStyles/LoginForm.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useApp();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const togglePassword = () => setShowPassword((v) => !v);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      const res = await api.post("/auth/login", { username, password });
      const { accessToken, user, menu, permissions } = res.data;
      login(user, menu, permissions, accessToken);
      navigate("/home", { replace: true });
    } catch (err) {
      setError("Usuario o contraseña incorrectos");
      console.error("Error login:", err?.response || err);
    }
  };

  return (
    <div className="login-page">
      <header className="top-bar">
        <div className="topbar-inner">BigIA 2.0</div>
      </header>

      <main className="login-container">
        <form onSubmit={submit} className="login-form">
          <div className="login-logo" aria-hidden="true" />
          <h2>Acceso a BigIA 2.0</h2>

          <div className="input-wrapper">
            <input
              name="username"
              value={username}
              placeholder="Usuario"
              autoFocus
              required
              onChange={(e) => setUsername(e.target.value)}
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
            />
            <button
              type="button"
              className="eye-btn"
              onClick={togglePassword}
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              title={showPassword ? "Ocultar" : "Mostrar"}
            >
              <IconResolver name={showPassword ? "visibility-off" : "visibility"} size={18} />
            </button>
          </div>

          <button type="submit" className="submit-btn">Entrar</button>

          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
        </form>
      </main>
    </div>
  );
}
