import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/themes.css';
import './index.css';
import App from './App.jsx';
import './styles/controls.css';
import { AppProvider } from './context/AppContext'; // ✅ importa tu provider
import { ConfigProvider } from './context/ConfigContext'; // ✅ importa tu provider
import SplashGate from "./components/SplashGate.jsx";
import { bootApplyBrandingFromCache } from "./utils/favicon";

bootApplyBrandingFromCache();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* SplashGate muestra el logo hasta que la app esté lista */}
    <SplashGate minDuration={800}>
      <ConfigProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </ConfigProvider>
    </SplashGate>
  </StrictMode>
);
