// BigIA2Frontend/src/utils/favicon.js

// Helpers dom
function ensureLink(id, rel, type) {
  let link = document.querySelector(`link#${id}`);
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    if (rel) link.rel = rel;
    if (type) link.type = type;
    document.head.appendChild(link);
  }
  return link;
}
function ensureMeta(name) {
  let meta = document.querySelector(`meta[name="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', name);
    document.head.appendChild(meta);
  }
  return meta;
}

// Colores
function hexToRgb(hex) {
  if (!hex) return [196, 0, 0];
  const h = hex.replace('#','').trim();
  const full = h.length === 3 ? h.split('').map(c=>c+c).join('') : h.padEnd(6,'0').slice(0,6);
  const n = parseInt(full, 16);
  return [(n>>16)&255, (n>>8)&255, n&255];
}
function relLuminance([r,g,b]) {
  const t = (c)=> {
    c /= 255;
    return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  };
  const R=t(r), G=t(g), B=t(b);
  return 0.2126*R + 0.7152*G + 0.0722*B;
}
function rgba(rgb, a) { return `rgba(${rgb.join(',')},${a})`; }

// ===== FAVICON =====
// Recolorea un SVG remoto y lo inyecta como data URL (evita caché)
export async function setFaviconFromSvgUrl(svgPath, color) {
  try {
    const res = await fetch(svgPath, { cache: 'no-store' });
    let svg = await res.text();

    // Quitar fills explícitos (salvo "none") y aplicar tu color en la etiqueta <svg>
    svg = svg
      .replace(/fill="(?!none")[^"]*"/gi, '')
      .replace(/<svg\b([^>]*?)>/i, `<svg$1 fill="${color}" color="${color}">`);

    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    const link = ensureLink('app-favicon', 'icon', 'image/svg+xml');
    link.setAttribute('href', dataUrl);

    // Para algunos navegadores conviene añadir también rel="shortcut icon"
    const link2 = ensureLink('app-favicon-ico', 'shortcut icon', 'image/svg+xml');
    link2.setAttribute('href', dataUrl);
  } catch (e) {
    console.warn('No pude recolorear el favicon, uso el SVG original:', e);
    const link = ensureLink('app-favicon', 'icon', 'image/svg+xml');
    link.setAttribute('href', svgPath);
  }
}

// Safari pinned tabs
export function setMaskIcon(color, href = '/logoBigIA.svg') {
  const link = ensureLink('app-mask-icon', 'mask-icon');
  link.setAttribute('href', href);
  link.setAttribute('color', color);
}

// Android/iOS barra del navegador
export function setThemeColor(color) {
  const meta = ensureMeta('theme-color');
  meta.setAttribute('content', color);
}

// ===== SPLASH / CSS VARS derivadas =====
export function applySplashCssVars(color) {
  try {
    const root = document.documentElement;
    const rgb = hexToRgb(color);

    root.style.setProperty('--brand', color);
    root.style.setProperty('--brand-rgb', `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`);

    // Fondo del Splash “tinteado” por la marca
    const grad = `
      radial-gradient(60% 60% at 25% 20%, ${rgba(rgb, .10)} 0%, transparent 60%),
      linear-gradient(135deg, ${rgba(rgb, .05)} 0%, ${rgba(rgb, .02)} 100%)
    `.replace(/\s+/g,' ');
    root.style.setProperty('--splash-bg', grad);

    // Texto/spinner en splash con contraste
    const fg = relLuminance(rgb) > 0.5 ? '#111111' : '#ffffff';
    root.style.setProperty('--splash-fg', fg);
  } catch (e) {
    /* noop */
  }
}

// ===== APLICADOR ÚNICO =====
export function applyBranding(color, logoPath = '/logoBigIA.svg') {
  if (!color) color = '#c40000';
  applySplashCssVars(color);
  setThemeColor(color);
  setMaskIcon(color, logoPath);
  // recolorear favicon en paralelo, no bloquear UI
  setFaviconFromSvgUrl(logoPath, color);
}

// ===== Arranque temprano (antes de React) =====
export function bootApplyBrandingFromCache() {
  try {
    // nuevo esquema
    const cfg = JSON.parse(localStorage.getItem('bigia_config') || 'null');
    // compat con la app original
    const legacy = JSON.parse(localStorage.getItem('branding_cache_v1') || '{}');
    const color = (cfg && cfg.topbar_color) || legacy.topbar_color || '#c40000';
    applyBranding(color, '/logoBigIA.svg');
  } catch {
    applyBranding('#c40000', '/logoBigIA.svg');
  }
}
