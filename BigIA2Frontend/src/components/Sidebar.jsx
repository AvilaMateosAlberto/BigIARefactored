import React, { useEffect, useMemo, useState } from "react";
import "./componentsStyles/Sidebar.css";
import IconResolver from "./IconResolver";

/**
 * Estructura del árbol:
 * [{ id, type: 'folder'|'page', label, route?, icon?, url?, badge?, children? }, ...]
 */

function findPathByRoute(nodes, route, path = []) {
  for (const n of nodes || []) {
    const curr = [...path, n];
    if (n.route === route) return curr;
    if (n.type === "folder" && n.children?.length) {
      const f = findPathByRoute(n.children, route, curr);
      if (f) return f;
    }
  }
  return null;
}

function NodeRow({ node, depth, expanded, toggle, activePath, onNavigate }) {
  const isFolder = node.type === "folder";
  const isActive = node.route === activePath;
  const isExpanded = expanded.has(node.id);
  const hasChildren = isFolder && node.children?.length;

  const onClick = () => {
    if (isFolder) toggle(node.id);
    else if (node.route) onNavigate(node.route);
  };

  return (
    <div className="st-node" style={{ "--depth": depth }} role="none">
      <div
        className={`st-row ${isFolder ? "is-folder" : "is-page"} ${isActive ? "is-active" : ""}`}
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-current={isActive ? "page" : undefined}
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
          if (isFolder && e.key === "ArrowRight" && !isExpanded) toggle(node.id);
          if (isFolder && e.key === "ArrowLeft" && isExpanded) toggle(node.id);
        }}
      >
        {/* Chevron solo en carpetas */}
        {isFolder ? (
          <span className={`st-chevron ${isExpanded ? "rot" : ""}`} aria-hidden="true" />
        ) : (
          <span className="st-chevron st-hidden" aria-hidden="true" />
        )}

        <span className="st-icon">
          <IconResolver name={node.icon || (isFolder ? "folder" : "link")} size={18} />
        </span>

        <span className="st-label">{node.label}</span>

        {node.badge != null && <span className="st-badge">{node.badge}</span>}
      </div>

      {/* hijos */}
      {hasChildren && (
        <div className={`st-children ${isExpanded ? "open" : ""}`} role="group" style={{ "--parent-depth": depth }}>
          {node.children.map((child) => (
            <NodeRow
              key={child.id ?? child.route ?? child.label}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              activePath={activePath}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  tree = [],
  activePath = "/",
  onNavigate,
  collapsed = false,
  onClose,
}) {
  const [expanded, setExpanded] = useState(() => new Set());

  // auto-expand ancestros del activo
  const ancestors = useMemo(() => findPathByRoute(tree, activePath) || [], [tree, activePath]);
  useEffect(() => {
    const next = new Set(expanded);
    for (const n of ancestors) if (n.type === "folder") next.add(n.id);
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, tree]);

  const toggle = (id) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const handleNavigate = (route) => {
    onNavigate?.(route);
    onClose?.();
  };

  return (
    <aside id="app-sidebar" className={`sidebar ${collapsed ? "is-open" : ""}`} aria-label="Navegación lateral">
      <div className="sidebar-scroll" role="tree" aria-label="Menú">
        <nav className="st-tree">
          {tree.map((node) => (
            <NodeRow
              key={node.id ?? node.route ?? node.label}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              activePath={activePath}
              onNavigate={handleNavigate}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
