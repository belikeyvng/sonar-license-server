// routes/payment.js
//
// POST /transaction/initialize
// Called by the Electron app when the user clicks "Upgrade to Pro".
// Starts a Paystack transaction and hands back the checkout URL the
// app opens in its BrowserWindow popup.

const express = require("express");
const { initializeTransaction } = require("../lib/paystack");
const store = require("../lib/store");

const router = express.Router();

// Test-mode price for Sonar Pro. Paystack amounts are in kobo
// (smallest unit) — matches the N4,500/month shown in upgrade-page.css,
// as a one-time charge per the "one-time for now" decision.
const PRO_PRICE_KOBO = 450000; // N4,500.00

router.post("/transaction/initialize", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    return res.status(400).json({ status: false, message: "email is required" });
  }

  try {
    const { authorizationUrl, reference } = await initializeTransaction({
      email,
      amountKobo: PRO_PRICE_KOBO,
    });

    store.setPending(reference);

    res.json({
      status: true,
      authorizationUrl,
      reference,
    });
  } catch (err) {
    console.error("Failed to initialize transaction:", err.message);
    res.status(502).json({ status: false, message: "Could not start payment." });
  }
});

module.exports = router;
