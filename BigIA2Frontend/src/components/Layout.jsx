import React, { useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Topbar from "./Topbar";
import Sidebar from "./Sidebar";

export default function Layout({
  title = "BigIA 2.0",
  menu = [],
  rightSlot,
  leftSlot,
  onNavigate: onNavigateProp,
  activePath: activePathProp,
  children,
}) {
  const navigate = useNavigate?.();
  const location = useLocation?.();
  const hasRouter = Boolean(location && navigate);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activePath = useMemo(() => {
    if (activePathProp) return activePathProp;
    if (hasRouter) return location.pathname;
    return "/";
  }, [activePathProp, hasRouter, location]);

  const onNavigate = (path) => {
    if (onNavigateProp) return onNavigateProp(path);
    if (hasRouter && path) navigate(path);
  };

  useEffect(() => { if (sidebarOpen) setSidebarOpen(false); }, [activePath]);

  return (
    <div className="appshell">
      <Topbar
        title={title}
        leftSlot={leftSlot}
        rightSlot={rightSlot}
        onBurger={() => setSidebarOpen((s) => !s)}
      />

      <div className="appshell-main" style={{ display: "flex", minHeight: "calc(100vh - 56px)" }}>
        <Sidebar
          menu={menu}
          activePath={activePath}
          onNavigate={onNavigate}
          collapsed={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="appshell-content" role="main" style={{ flex: 1 }}>
          {hasRouter ? <Outlet /> : children}
        </main>
      </div>
    </div>
  );
}
