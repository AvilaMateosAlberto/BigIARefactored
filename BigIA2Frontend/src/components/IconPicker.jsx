import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as MuiIcons from '@mui/icons-material';
import './componentsStyles/IconPicker.css';

function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside?.();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [ref, onOutside]);
}

export default function IconPicker({
  value,
  onChange,
  placeholder = 'Selecciona un icono…',
}) {
  const wrapperRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(120);

  useOutsideClick(wrapperRef, () => setOpen(false));

  // Lista de iconos disponibles (nombres exportados por @mui/icons-material)
  const allIcons = useMemo(() => {
    return Object.keys(MuiIcons).filter((n) => /^[A-Z]/.test(n));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = q ? allIcons.filter((n) => n.toLowerCase().includes(q)) : allIcons;
    return arr.slice(0, limit);
  }, [allIcons, query, limit]);

  const SelectedIcon = value && MuiIcons[value] ? MuiIcons[value] : null;

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      setLimit((prev) => Math.min(prev + 200, allIcons.length));
    }
  }

  function pick(name) {
    onChange?.(name);
    setOpen(false);
  }

  return (
    <div className="iconpicker" ref={wrapperRef}>
      <div className="iconpicker-inputrow">
        <div className="iconpicker-preview" title={value || 'Sin icono'}>
          {SelectedIcon ? (
            <SelectedIcon fontSize="small" />
          ) : (
            <span className="iconpicker-empty">—</span>
          )}
        </div>

        {/* Al enfocar este input se abre el popover */}
        <input
          className="iconpicker-input"
          value={value || ''}
          onChange={(e) => onChange?.(e.target.value)}
          onFocus={() => setOpen(true)}             
          placeholder={placeholder}
          spellCheck={false}
        />

        {value && (
          <button
            type="button"
            className="iconpicker-clear"
            onClick={() => onChange?.('')}
            title="Quitar icono"
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div className="iconpicker-popover">
          <div className="iconpicker-searchrow">
            <input
              autoFocus
              className="iconpicker-search"
              placeholder="Buscar icono (ej. dashboard, person, settings…)"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setLimit(200);
              }}
              spellCheck={false}
              onFocus={() => setOpen(true)}          
            />
          </div>

          <div className="iconpicker-grid" ref={listRef} onScroll={handleScroll}>
            {filtered.map((name) => {
              const IconComp = MuiIcons[name];
              return (
                <button
                  key={name}
                  type="button"
                  className={'iconpicker-item' + (value === name ? ' selected' : '')}
                  title={name}
                  onClick={() => pick(name)}
                >
                  <IconComp fontSize="small" />
                  <span className="iconpicker-label">{name}</span>
                </button>
              );
            })}
            {!filtered.length && (
              <div className="iconpicker-emptyresult">Sin resultados</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}