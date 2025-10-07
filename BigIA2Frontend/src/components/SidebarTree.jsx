import React, { useEffect, useMemo, useState } from "react";
import "./componentsStyles/SidebarTree.css";
import IconResolver from "./IconResolver";

/**
 * @typedef {Object} TreeNode
 * @property {'folder'|'page'} type
 * @property {string} label
 * @property {string} [route]     // solo páginas (o carpetas clicables si quieres)
 * @property {string} [icon]      // nombre en IconResolver
 * @property {string} [id]        // recomendable: estable y único
 * @property {string} [url]       // si es una página con iframe (Kibana, etc.)
 * @property {TreeNode[]} [children]
 * @property {string|number} [badge] // opcional
 */

function findPathByRoute(nodes, route, path = []) {
  for (const n of nodes || []) {
    const current = [...path, n];
    if (n.route === route) return current;
    if (n.type === "folder" && n.children?.length) {
      const found = findPathByRoute(n.children, route, current);
      if (found) return found;
    }
  }
  return null;
}

function NodeRow({
  node,
  depth,
  expanded,
  toggle,
  active,
  onNavigate,
}) {
  const isFolder = node.type === "folder";
  const hasChildren = Boolean(node.children?.length);
  const isExpanded = expanded.has(node.id);

  const onClickRow = () => {
    if (isFolder) toggle(node.id);
    else onNavigate?.(node.route);
  };

  return (
    <div className="st-node" role="none" style={{ "--depth": depth }}>
      <div
        className={`st-row ${active ? "is-active" : ""} ${isFolder ? "is-folder" : "is-page"}`}
        role="treeitem"
        aria-expanded={isFolder ? isExpanded : undefined}
        aria-current={active ? "page" : undefined}
        onClick={onClickRow}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClickRow();
          }
          if (isFolder && (e.key === "ArrowRight")) !isExpanded && toggle(node.id);
          if (isFolder && (e.key === "ArrowLeft")) isExpanded && toggle(node.id);
        }}
      >
        <span className={`st-chevron ${isFolder ? "" : "st-hidden"} ${isExpanded ? "rot" : ""}`} aria-hidden>
          ▶
        </span>
        <span className="st-icon">
          <IconResolver name={node.icon || (isFolder ? "folder" : "link")} size={18} />
        </span>
        <span className="st-label">{node.label}</span>
        {node.badge != null && <span className="st-badge">{node.badge}</span>}
      </div>

      {isFolder && hasChildren && (
        <div
          className={`st-children ${isExpanded ? "open" : ""}`}
          role="group"
          style={{ "--h": isExpanded ? "auto" : 0 }}
        >
          {node.children.map((child) => (
            <NodeRow
              key={child.id ?? (child.route || child.label)}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              active={child.route === active}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SidebarTree({
  tree = /** @type {TreeNode[]} */ ([]),
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
    onClose?.(); // cerrar en móvil
  };

  return (
    <aside className={`sidebar ${collapsed ? "is-open" : ""}`} aria-label="Navegación lateral">
      <div className="sidebar-scroll" role="tree" aria-label="Menú">
        <nav className="st-tree">
          {tree.map((node) => (
            <NodeRow
              key={node.id ?? (node.route || node.label)}
              node={node}
              depth={0}
              expanded={expanded}
              toggle={toggle}
              active={node.route === activePath}
              onNavigate={handleNavigate}
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}
