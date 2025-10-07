import React from "react";
import * as Icons from "@mui/icons-material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

/**
 * Uso:
 *  <IconResolver name="home" size={18} />
 *  <IconResolver iconName="Home" fontSize="small" />
 */
const NAME_MAP = {
  // genéricos de tu app → MUI component names
  home: "Home",
  cog: "Settings",
  settings: "Settings",
  link: "Link",
  bell: "Notifications",
  user: "Person",
  logout: "Logout",
  moon: "DarkMode",
  sun: "LightMode",
  folder: "Folder",
  folderOpen: "FolderOpen",
  menu: "Menu",
  // añade aquí los que quieras: "shield": "Shield", etc.
};

export default function IconResolver(props) {
  const { name, iconName, size, ...rest } = props;

  // 1) nombre de entrada (prefiere `name`; si no, `iconName`)
  const raw = (name ?? iconName ?? "").toString();

  // 2) normalización: permite "home", "Home", "HomeIcon"
  const candidate =
    NAME_MAP[raw] ||
    raw.replace(/Icon$/, ""); // quita sufijo Icon si viene

  const IconCmp = Icons[candidate] || HelpOutlineIcon;

  // 3) tamaño: si pasas `size` numérico, lo aplicamos via style; si no, usa props MUI (small/medium/large)
  const style = size ? { fontSize: size, ...(rest.style || {}) } : rest.style;

  return <IconCmp {...rest} style={style} />;
}
