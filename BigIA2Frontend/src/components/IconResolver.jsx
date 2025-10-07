// src/components/IconResolver.jsx
import React from "react";

/**
 * IconResolver: iconos simples en SVG sin dependencias.
 * Usa <IconResolver name="bell" size={18} />
 */
const paths = {
  bell: "M8 16h8M4 13h16a6 6 0 0 1-6-6V6a4 4 0 0 0-8 0v1a6 6 0 0 1-2 6Z",
  settings:
    "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3 2-1-2-3-2 .8a6.7 6.7 0 0 0-1.5-.9l-.3-2.2h-4l-.3 2.2c-.5.2-1 .5-1.5.9L6 8l-2 3 2 1c0 .5 0 1 .1 1.5L4 14l2 3 1.9-1.3c.5.4 1 .7 1.5.9l.3 2.4h4l.3-2.4c.5-.2 1-.5 1.5-.9L20 17l2-3-2-1c.1-.5.1-1 .1-1.5Z",
  user: "M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm8 9v-1a7 7 0 0 0-14 0v1Z",
  logout: "M16 17l5-5-5-5M21 12H9M13 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7",
  sun: "M12 4V2m0 20v-2M4 12H2m20 0h-2M5 5l-1-1m16 16-1-1M5 19l-1 1m16-16 1-1M12 8a4 4 0 1 1-4 4 4 4 0 0 1 4-4Z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z",
  menu: "M3 7h18M3 12h18M3 17h18",
  home: "M3 12l9-7 9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  link: "M10 13a5 5 0 0 1 0-7l2-2a5 5 0 0 1 7 7l-1 1M14 11a5 5 0 0 1 0 7l-2 2a5 5 0 0 1-7-7l1-1",
  folder: "M3 7h6l2 2h10v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z",
  folderOpen: "M3 7h6l2 2h10v4H7l-2 6H3V7z",
};

export default function IconResolver({ name, size = 18, stroke = "currentColor" }) {
  const d = paths[name] || paths["link"];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
    </svg>
  );
}
