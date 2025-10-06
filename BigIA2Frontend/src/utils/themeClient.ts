// src/utils/themeClient.ts
export function setTheme(mode: "light"|"dark") {
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  localStorage.setItem("pref_theme", mode);
}

export function setBrand(colorHex: string) {
  const root = document.documentElement;
  root.style.setProperty("--brand", colorHex);
  localStorage.setItem("brand_color", colorHex);
}

export function loadBrandingFromServerAndApply(data: {
  topbar_color?: string;
  topbar_text?: string;
}) {
  if (data?.topbar_color) setBrand(data.topbar_color);
  if (data?.topbar_text) {
    localStorage.setItem("brand_topbar_text", data.topbar_text);
    document.title = data.topbar_text;
  }
}
