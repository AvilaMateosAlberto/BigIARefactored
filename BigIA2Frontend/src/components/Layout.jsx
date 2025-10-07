// src/components/Layout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Topbar from "./Topbar";
import SidebarTree from "./SidebarTree";

/**
 * AppShell reutilizable con SidebarTree (carpetas + páginas).
 * - title, menu (array árbol), rightSlot/leftSlot (slots opcionales)
 * - Usa react-router (navigate/location) y cierra el sidebar al cambiar de ruta.
 */
export default function Layout({
  title = "BigIA 2.0",
  menu = [],            // árbol: [{ id, type:'folder'|'page', label, route?, icon?, children? }, ...]
  rightSlot,
  leftSlot,
  onNavigate: onNavigateProp,
  activePath: activePathProp,
  children,
}) {
  // Estamos dentro de Router, así que podemos usar hooks directamente
  const navigate = useNavigate();
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activePath = useMemo(() => {
    if (activePathProp) return activePathProp;
    return location.pathname || "/";
  }, [activePathProp, location.pathname]);

  const onNavigate = (path) => {
    if (!path) return;
    if (onNavigateProp) onNavigateProp(path);
    else navigate(path);
  };

  // Cerrar sidebar en móvil cuando cambia la ruta activa
  useEffect(() => {
    if (sidebarOpen) setSidebarOpen(false);
  }, [activePath]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="appshell">
      <Topbar
        title={title}
        leftSlot={leftSlot}
        rightSlot={rightSlot}
        onBurger={() => setSidebarOpen((s) => !s)}
      />

      <div className="appshell-main" style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
        <SidebarTree
          tree={menu}
          activePath={activePath}
          onNavigate={onNavigate}
          collapsed={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="appshell-content" role="main" style={{ flex: 1 }}>
          {/* Si usas router → Outlet; si no, renderiza children */}
          {<Outlet /> ?? children}
        </main>
      </div>
    </div>
  );
}
