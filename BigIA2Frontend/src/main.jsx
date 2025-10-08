import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/themes.css';
import './index.css';
import App from './App.jsx';
import { AppProvider } from './context/AppContext'; // ✅ importa tu provider
import { ConfigProvider } from './context/ConfigContext'; // ✅ importa tu provider

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider>
    <AppProvider>
      <App />
    </AppProvider>
    </ConfigProvider>
  </StrictMode>
);
