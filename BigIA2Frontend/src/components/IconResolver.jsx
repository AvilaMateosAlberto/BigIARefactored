// src/components/IconResolver.jsx
import React from "react";
import * as Icons from "@mui/icons-material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

export default function IconResolver({ name, iconName, size, style, ...rest }) {
  const raw = (name ?? iconName ?? "").toString().trim();
  if (!raw) return <HelpOutlineIcon {...rest} style={style} />;

  // Normaliza nombre: convierte “visibility-off” o “visibility_off” → “VisibilityOff”
  const cleaned = raw
    .replace(/icon$/i, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, chr) => chr.toUpperCase());
  const pascal = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

  // Busca variantes típicas de MUI
  const candidates = [
    pascal,
    `${pascal}Outlined`,
    `${pascal}Rounded`,
    `${pascal}TwoTone`,
    `${pascal}Sharp`,
  ];
  const IconCmp = candidates.map((c) => Icons[c]).find(Boolean) || HelpOutlineIcon;

  const mergedStyle = size ? { fontSize: size, ...(style || {}) } : style;

  return <IconCmp {...rest} style={mergedStyle} />;
}
