// src/components/SplashGate.jsx
import React, { useState, useCallback } from "react";
import SplashScreen from "./SplashScreen";

/**
 * Este componente muestra el SplashScreen hasta que la página esté cargada
 * (evento window.load) y haya pasado un tiempo mínimo (800 ms).
 */
export default function SplashGate({ children, minDuration = 800 }) {
  const [ready, setReady] = useState(false);
  const handleFinish = useCallback(() => setReady(true), []);

  return (
    <>
      {!ready && <SplashScreen minDuration={minDuration} onFinish={handleFinish} />}
      {ready && children}
    </>
  );
}
