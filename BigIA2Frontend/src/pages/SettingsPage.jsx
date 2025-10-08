// src/pages/SettingsPage.jsx
import React, { useEffect, useState } from 'react';
import api from '../api/axiosInstance';

const LS_KEY = 'branding_base_color_v1';

export default function SettingsPage() {
  const [color, setColor] = useState('#c40021'); // predeterminado
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    // carga local (y aplica)
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      setColor(saved);
      applyColor(saved);
    }
  }, []);

  function applyColor(value) {
    const root = document.documentElement;
    root.style.setProperty('--brand', value);
    // ejemplo de derivadas si ya las usas:
    root.style.setProperty('--topbar-bg', value);
    // añade más variables si tu tema las usa...
  }

  async function handleSave() {
    try {
      setSaving(true);
      setMsg('');
      // Guardado local inmediato (para que persista aunque el backend no exista)
      localStorage.setItem(LS_KEY, color);
      applyColor(color);

      // Si tienes un endpoint para branding, descomenta:
      // await api.post('/branding', { baseColor: color });

      setMsg('Guardado ✅');
    } catch (e) {
      setMsg(e?.response?.data?.error || 'No se pudo guardar');
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 2000);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>🎨 Personalización</h1>
      <p style={{ color: 'var(--muted-foreground, #888)' }}>
        Ajusta el color base de la aplicación (afecta a barra superior, botones, acentos, etc.).
      </p>

      <div style={{
        marginTop: 16, display: 'flex', gap: 16, alignItems: 'center',
        padding: 16, border: '1px solid var(--border, #2a2a2a)', borderRadius: 12
      }}>
        <label style={{ minWidth: 140 }}>Color corporativo</label>
        <input type="color" value={color} onChange={e => setColor(e.target.value)} />
        <button onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        {msg && <span style={{ marginLeft: 8 }}>{msg}</span>}
      </div>

      <div style={{ marginTop: 24 }}>
        <small>
          Consejo: si tu backend expone configuración de marca, conecta aquí el POST a <code>/branding</code>.
        </small>
      </div>
    </div>
  );
}

