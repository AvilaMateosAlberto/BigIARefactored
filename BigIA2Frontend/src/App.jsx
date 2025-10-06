import LoginForm from "./pages/LoginForm";
import "./styles/themes.css";
import "./App.css";

export default function App() {
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
