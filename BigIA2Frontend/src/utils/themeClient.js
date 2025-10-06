// Aplica el color corporativo y calcula --on-primary legible
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return { r: 196, g: 0, b: 0 }; // fallback rojo
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function getOnPrimary(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luma = (0.2126*r + 0.7152*g + 0.0722*b) / 255;
  return luma < 0.5 ? '#fff' : '#000';
}
export function applyBrand(hex) {
  try {
    document.documentElement.style.setProperty('--brand', hex);
    document.documentElement.style.setProperty('--on-primary', getOnPrimary(hex));
  } catch {}
}
