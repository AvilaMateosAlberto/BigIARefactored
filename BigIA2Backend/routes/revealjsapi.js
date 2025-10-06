// src/backend/routes/revealjsapi.js
const express = require("express");
const multer = require("multer");
const FormData = require("form-data");
const { verifyToken, authorizeMinLevel } = require("../middleware/auth");

const router = express.Router();

const UPSTREAM = process.env.REVEAL_UPSTREAM_BASE || "";
const IS_CONFIGURED = !!UPSTREAM && UPSTREAM.trim() !== "";

function notConfigured(res) {
  return res.status(501).json({
    status: "error",
    message: "REVEAL_UPSTREAM_BASE no está configurado en el backend.",
  });
}

// ==== helpers para cabeceras a reenviar ====
function buildForwardHeaders(req, extra = {}) {
  const h = {
    ...(req.headers["authorization"] ? { Authorization: req.headers["authorization"] } : {}),
    ...(req.headers["cookie"] ? { Cookie: req.headers["cookie"] } : {}),
    "X-Forwarded-For": req.ip || req.headers["x-forwarded-for"] || "",
    ...extra,
  };
  return h;
}

// ==== util para enviar respuesta del fetch manteniendo cabeceras ====
async function forwardFetch(res, upstreamRes) {
  try {
    const headersToCopy = [
      "content-type",
      "content-disposition",
      "last-modified",
      "etag",
      "cache-control",
      "expires",
    ];
    for (const h of headersToCopy) {
      const v = upstreamRes.headers.get(h);
      if (v) res.setHeader(h.replace(/(^.|-[a-z])/g, s => s.toUpperCase()), v);
    }
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    return res.status(upstreamRes.status).send(buf);
  } catch {
    return res.status(500).json({ status: "error", message: "Fallo reenviando respuesta del upstream." });
  }
}

// ====== Upload (PNG ≤ 1MB) ======
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== "image/png") return cb(new Error("Solo se acepta PNG (image/png)."));
    cb(null, true);
  },
});

// Permitimos `logo_cliente` y `logo` por compatibilidad
const uploadLogoFields = upload.fields([
  { name: "logo_cliente", maxCount: 1 },
  { name: "logo", maxCount: 1 },
]);

const pickLogoFile = (req) => {
  const byKey = (k) =>
    req.files && Array.isArray(req.files[k]) && req.files[k][0] ? req.files[k][0] : null;
  return byKey("logo_cliente") || byKey("logo") || null;
};

// ====== Rutas proxy ======

router.get(["/assets/*", "/assets/*/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const tail = (req.params[0] || "").replace(/\/+$/, "");
    const url = `${UPSTREAM}/assets/${tail}`;
    const upstreamRes = await fetch(url, { method: "GET", headers: buildForwardHeaders(req) });
    return forwardFetch(res, upstreamRes);
  } catch (e) {
    console.error("❌ proxy assets:", e);
    return res.status(500).send("Error al obtener asset del upstream");
  }
});

router.get(["/get_client_info", "/get_client_info/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/get_client_info`, {
      method: "GET",
      headers: buildForwardHeaders(req),
    });
    return forwardFetch(res, upstreamRes);
  } catch (err) {
    console.error("❌ proxy get_client_info:", err);
    return res.status(500).json({ status: "error", message: "No se pudo contactar con el upstream." });
  }
});

router.post(
  ["/update_client_info", "/update_client_info/"],
  verifyToken,
  authorizeMinLevel(2),
  uploadLogoFields,
  async (req, res) => {
    if (!IS_CONFIGURED) return notConfigured(res);
    try {
      const form = new FormData();
      form.append("nombre_cliente", (req.body?.nombre_cliente ?? "").toString());
      form.append("autor", (req.body?.autor ?? "").toString());
      form.append("observaciones", (req.body?.observaciones ?? "").toString());

      const logo = pickLogoFile(req);
      if (logo) {
        form.append("logo_cliente", logo.buffer, {
          filename: "logo_cliente.png",
          contentType: "image/png",
        });
      }

      const upstreamRes = await fetch(`${UPSTREAM}/update_client_info`, {
        method: "POST",
        headers: buildForwardHeaders(req, form.getHeaders()),
        body: form,
      });
      return forwardFetch(res, upstreamRes);
    } catch (err) {
      console.error("❌ proxy update_client_info:", err);
      const isSize = err?.code === "LIMIT_FILE_SIZE";
      const message = isSize ? "Logo inválido (solo PNG, máx. 1MB)." : "No se pudo contactar con el upstream.";
      return res.status(500).json({ status: "error", message });
    }
  }
);

router.post(["/generate_report", "/generate_report/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/generate_report`, {
      method: "POST",
      headers: buildForwardHeaders(req, { "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    return forwardFetch(res, upstreamRes);
  } catch (err) {
    console.error("❌ proxy generate_report:", err);
    return res.status(500).json({ status: "error", message: "No se pudo contactar con el upstream." });
  }
});

router.post(["/generate_pdf", "/generate_pdf/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/generate_pdf`, {
      method: "POST",
      headers: buildForwardHeaders(req, { "Content-Type": "application/json" }),
      body: JSON.stringify({}),
    });
    return forwardFetch(res, upstreamRes);
  } catch (err) {
    console.error("❌ proxy generate_pdf:", err);
    return res.status(500).json({ status: "error", message: "No se pudo contactar con el upstream." });
  }
});

router.head(["/pdf_status", "/pdf_status/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/pdf_status`, { method: "HEAD", headers: buildForwardHeaders(req) });
    return res.sendStatus(upstreamRes.status || 200);
  } catch {
    return res.sendStatus(404);
  }
});

router.get(["/pdf_status", "/pdf_status/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/pdf_status`, {
      method: "GET",
      headers: buildForwardHeaders(req, { Accept: "application/json" }),
    });
    return forwardFetch(res, upstreamRes);
  } catch {
    return res.status(404).json({ status: "error", message: "No disponible." });
  }
});

router.get(["/download_report", "/download_report/"], verifyToken, authorizeMinLevel(1), async (req, res) => {
  if (!IS_CONFIGURED) return notConfigured(res);
  try {
    const upstreamRes = await fetch(`${UPSTREAM}/download_report`, {
      method: "GET",
      headers: buildForwardHeaders(req),
    });
    return forwardFetch(res, upstreamRes);
  } catch (err) {
    console.error("❌ proxy download_report:", err);
    return res.status(500).json({ status: "error", message: "No se pudo contactar con el upstream." });
  }
});

// ====== Manejo de errores de subida (multer) ======
router.use((err, _req, res, _next) => {
  if (!err) return res.status(500).json({ status: "error", message: "Error desconocido." });
  const message =
    err.code === "LIMIT_FILE_SIZE"
      ? "Logo inválido (solo PNG, máx. 1MB)."
      : (err.message || "Error en la subida del logo.");
  return res.status(400).json({ status: "error", message });
});

module.exports = router;
