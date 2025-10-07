// src/pages/LoginForm.jsx
import { useState } from "react";
import axios from "../api/axiosInstance";
import "./pagesStyles/LoginForm.css";
import IconResolver from "../components/IconResolver"; // ✅ tu clase global de iconos

// import { useApp } from "../context/AppContext";

export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  // const { login, config } = useApp();

  const togglePassword = () => setShowPassword((v) => !v);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    try {
      const res = await axios.post("/auth/login", { username, password });
      const { accessToken, user, menu, permissions } = res.data;
      login(user, menu, permissions, accessToken);

      setInfo("Demo: aquí iría tu lógica de login.");
    } catch (err) {
      setError("Usuario o contraseña incorrectos");
      console.error("Error login:", err?.response || err);
    }
  };

  const title = /* config?.login_message || */ "Acceso a BigIA 2.0";

  return (
    <form onSubmit={submit} className="login-form">
      <div className="login-logo" aria-hidden="true" />
      <h2>{title}</h2>

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
          {showPassword ? (
            <IconResolver name="visibility-off" size={18} />
          ) : (
            <IconResolver name="visibility" size={18} />
          )}
        </button>
      </div>

      <button type="submit" className="submit-btn">Entrar</button>

      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
    </form>
  );
}
