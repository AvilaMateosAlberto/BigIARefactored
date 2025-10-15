// src/ui/alerts.js
import Swal from "sweetalert2";

/** Theme + brand helpers */
const brandColor = () =>
  getComputedStyle(document.documentElement).getPropertyValue("--brand")?.trim() || "#c40000";
const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

const base = () => ({
  background: isDark() ? "#2e2e2e" : "#fff",
  color: isDark() ? "#eee" : "#111",
  confirmButtonColor: brandColor(),
  cancelButtonColor: "#888",
});

/** ---------- BÁSICOS (modales centrados) ---------- */
export const ok = (title = "Hecho", text = "Operación realizada") =>
  Swal.fire({ ...base(), icon: "success", title, text });

export const err = (title = "Error", text = "Ha ocurrido un error") =>
  Swal.fire({ ...base(), icon: "error", title, text });

export const info = (title = "Info", text = "") =>
  Swal.fire({ ...base(), icon: "info", title, text });

export const confirm = (title, text, confirmText = "Sí, continuar") =>
  Swal.fire({
    ...base(),
    title,
    text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: "Cancelar",
  });



/** ---------- TOASTS (esquineros auto-cierre) ---------- */
export const toast = (title, icon = "info", ms = 2000, position = "top-end") =>
  Swal.fire({
    ...base(),
    toast: true,
    position,
    timer: ms,
    timerProgressBar: true,
    showConfirmButton: false,
    title,
    icon,
  });

export const toastOk   = (title = "Hecho")  => toast(title, "success");
export const toastErr  = (title = "Error")  => toast(title, "error");
export const toastInfo = (title = "Info")   => toast(title, "info");

/** Presets informativos (siempre toast) */
export const created   = (what = "Elemento creado")       => toastOk(what);
export const updated   = (what = "Cambios guardados")     => toastOk(what);
export const removed   = (what = "Elemento eliminado")   => toastOk(what);
export const reloaded  = (what = "Recargado")             => toastOk(what);

export const orderSaved       = () => toastOk("Orden guardado");
export const orderSaveError = () => toastErr("No se pudo guardar el orden");

/** ---------- LOADING MODAL (bloqueante) ---------- */
export const loading = (title = "Procesando…") =>
  Swal.fire({
    ...base(),
    title,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });

export const close = () => {
  try { Swal.close(); } catch {}
};

/** ---------- CASOS TÍPICOS (PRESSETS) ---------- */
// Login
export const validatingCredentials = () => loading("Validando credenciales…");

export const invalidCredentials = () =>
  Swal.fire({
    ...base(),
    icon: "error",
    title: "Credenciales inválidas",
    text: "Usuario o contraseña incorrectos",
    toast: true,
    position: "top-end",
    timer: 2000,
    timerProgressBar: true,
    showConfirmButton: false,
  });

// --- FUNCIÓN AÑADIDA ---
// Usa un modal centrado (err) en lugar de un toast para que el usuario no se lo pierda.
export const tooManyAttempts = (message = 'Demasiados intentos de inicio de sesión.') =>
  err('Límite de intentos alcanzado', message);


// Confirmaciones destructivas
export const confirmDeleteUser = (username = "") =>
  confirm(
    "¿Eliminar usuario?",
    username ? `Se eliminará el usuario "${username}".` : "Se eliminará el usuario.",
    "Sí, eliminar"
  );

export const confirmDeleteItem = (label = "elemento") =>
  confirm("¿Eliminar elemento?", `Se eliminará "${label}".`, "Sí, eliminar");

export const confirmDanger = (title = "¿Estás seguro?", text = "Esta acción no se puede deshacer") =>
  confirm(title, text, "Entiendo, continuar");

/** ---------- Helpers API ---------- */
export const apiOk = (msg = "Operación realizada") => toastOk(msg); // ← ahora toast, no modal
export const apiError = (e, fallback = "No se pudo completar la operación") => {
  const msg = e?.response?.data?.error || e?.message || fallback;
  return err("Error", msg); // errores críticos siguen siendo modal centrado
};