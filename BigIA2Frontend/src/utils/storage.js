// src/utils/storage.js

// Clave base opcional para mantener un namespace
const PREFIX = "bigia_";

export function setItem(key, value) {
  try {
    const data = typeof value === "string" ? value : JSON.stringify(value);
    localStorage.setItem(PREFIX + key, data);
  } catch (err) {
    console.warn("Error guardando en localStorage:", err);
  }
}

export function getItem(key, parse = true) {
  try {
    const data = localStorage.getItem(PREFIX + key);
    if (!data) return null;
    return parse ? JSON.parse(data) : data;
  } catch {
    return null;
  }
}

export function removeItem(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (err) {
    console.warn("Error eliminando en localStorage:", err);
  }
}

export function clearAll() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.warn("Error limpiando localStorage:", err);
  }
}
