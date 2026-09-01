// server.js
//
// Entry point. Note the webhook route is mounted BEFORE the app-wide
// express.json() middleware, using its own express.raw() — Paystack's
// signature check needs the exact raw bytes of the body, and once
// express.json() has parsed+re-serialized it, byte-for-byte equality
// with what Paystack signed is no longer guaranteed.

require("dotenv").config();

const express = require("express");
const paymentRoutes = require("./routes/payment");
const webhookRoutes = require("./routes/webhook");
const licenseRoutes = require("./routes/license");

const app = express();

// Webhook: raw body, mounted first, own middleware.
app.use(
  "/webhooks",
  express.raw({ type: "application/json" }),
  webhookRoutes,
);

// Everything else: normal JSON body parsing.
app.use(express.json());
app.use(paymentRoutes);
app.use(licenseRoutes);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Sonar license server listening on port ${PORT}`);
});
