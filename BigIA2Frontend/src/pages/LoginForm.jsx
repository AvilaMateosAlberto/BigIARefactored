import { useState } from "react";
import "./pagesStyles/LoginForm.css";

/**
 * Login "dummy": solo UI. No llama a APIs ni context.
 * Muestra/oculta contraseña, valida mínimo y enseña un mensaje local.
 */
export default function LoginForm() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const togglePassword = () => setShowPassword((v) => !v);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    setInfo("");

    if (!username || !password) {
      setError("Introduce usuario y contraseña.");
      return;
    }

    // Solo demostración:
    setInfo("Demo: aquí iría tu lógica de login.");
  };

  return (
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
        <span className="eye-icon" onClick={togglePassword} title="Mostrar/Ocultar">
          {showPassword ? "🙈" : "👁️"}
        </span>
      </div>

      <button type="submit">Entrar</button>

      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
    </form>
  );
}
