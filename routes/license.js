// routes/license.js
//
// GET /license/:reference
// Polled by the Electron app after the Paystack checkout popup closes.
// Returns whatever store.js currently has for that reference — the
// app just keeps asking until status flips from "pending" to "ready"
// (or "failed").

const express = require("express");
const store = require("../lib/store");

const router = express.Router();

router.get("/license/:reference", (req, res) => {
  const entry = store.get(req.params.reference);

  if (!entry) {
    return res.status(404).json({ status: "unknown" });
  }

  if (entry.status === "ready") {
    return res.json({ status: "ready", license: entry.license });
  }

  if (entry.status === "failed") {
    return res.json({ status: "failed", reason: entry.reason });
  }

  res.json({ status: "pending" });
});

module.exports = router;
