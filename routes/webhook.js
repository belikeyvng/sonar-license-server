// routes/webhook.js
//
// POST /webhooks/paystack
// Paystack calls this when a transaction event happens. This is the
// ONLY place a license actually gets issued — never on the client
// redirect, since that can be spoofed by anyone who knows the URL
// shape. Two layers of trust here, both required:
//
//   1. Verify the `x-paystack-signature` header — proves the request
//      really came from Paystack (HMAC-SHA512 of the raw body using
//      the secret key).
//   2. Independently call Paystack's verify endpoint for the
//      reference — proves the transaction really succeeded, rather
//      than trusting whatever the webhook body claims.
//
// Skipping either check means anyone who finds this URL could mint
// themselves a free Pro license.

const express = require("express");
const crypto = require("node:crypto");
const { verifyTransaction } = require("../lib/paystack");
const { issueLicense } = require("../lib/issueLicense");
const store = require("../lib/store");

const router = express.Router();

function isValidSignature(rawBody, signatureHeader) {
  if (!signatureHeader) return false;
  const secret = process.env.PAYSTACK_SECRET_KEY;
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signatureHeader;
}

// NOTE: this route needs the raw request body (not JSON-parsed) to
// compute the signature correctly — see server.js, where this route
// is mounted with express.raw() instead of the app-wide express.json().
router.post("/paystack", async (req, res) => {
  const rawBody = req.body; // Buffer, thanks to express.raw() in server.js
  const signature = req.headers["x-paystack-signature"];

  if (!isValidSignature(rawBody, signature)) {
    console.warn("Webhook signature check failed — rejecting.");
    return res.status(401).end();
  }

  // Acknowledge receipt immediately — Paystack expects a fast 200 and
  // will retry if it doesn't get one. Actual work happens after.
  res.status(200).end();

  let event;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch (err) {
    console.error("Webhook body was not valid JSON:", err.message);
    return;
  }

  if (event.event !== "charge.success") {
    return; // not the event we care about — ignore quietly
  }

  const reference = event.data?.reference;
  if (!reference) return;

  try {
    // Re-verify independently rather than trusting the webhook
    // payload's own "status" field.
    const verification = await verifyTransaction(reference);

    if (!verification.success) {
      store.setFailed(reference, "TRANSACTION_NOT_SUCCESSFUL");
      return;
    }

    const license = issueLicense("pro");
    store.setReady(reference, license);

    console.log(`Issued license ${license.payload.licenseId} for reference ${reference}`);
  } catch (err) {
    console.error(`Failed to process webhook for reference ${reference}:`, err.message);
    store.setFailed(reference, "PROCESSING_ERROR");
  }
});

module.exports = router;
