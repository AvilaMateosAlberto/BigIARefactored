import React, { useEffect, useState } from "react";
import "./componentsStyles/SplashScreen.css";

/**
 * SplashScreen:
 * - Muestra overlay con el logo tintado por --brand y un spinner.
 * - Se oculta tras el evento window 'load', respetando un mínimo de duración.
 */
export default function SplashScreen({ minDuration = 800, onFinish }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();

    const done = () => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(0, minDuration - elapsed);
      const t = setTimeout(() => {
        setVisible(false);
        onFinish?.();
      }, remaining);
      return () => clearTimeout(t);
    };

    if (document.readyState === "complete") {
      const cleanup = done();
      return cleanup;
    }

    const handler = () => done();
    window.addEventListener("load", handler, { once: true });
    return () => window.removeEventListener("load", handler);
  }, [minDuration, onFinish]);

  if (!visible) return null;

  return (
    <div className="splash-overlay" role="status" aria-live="polite">
      <div className="splash-content">
        <div
          className="splash-logo--tinted"
          role="img"
          aria-label="BigIA"
          title="BigIA"
        />
        <div className="splash-spinner" aria-hidden="true" />
      </div>
    </div>
  );
}
