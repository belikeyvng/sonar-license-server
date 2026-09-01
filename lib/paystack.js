// lib/paystack.js
//
// Minimal wrapper around the two Paystack REST calls this backend
// needs. No SDK dependency — Paystack's API is plain REST, a fetch
// wrapper is enough and keeps the dependency list small.

const fetch = require("node-fetch");

const PAYSTACK_BASE = "https://api.paystack.co";

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error(
      "PAYSTACK_SECRET_KEY is not set. Copy .env.example to .env and fill it in.",
    );
  }
  return key;
}

// Starts a one-time-payment transaction. Paystack returns a hosted
// checkout URL (authorization_url) the app opens in its BrowserWindow
// popup, plus a `reference` string that ties this transaction to the
// license we'll issue once payment succeeds.
async function initializeTransaction({ email, amountKobo }) {
  const res = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      amount: amountKobo, // Paystack amounts are in the smallest currency unit (kobo for NGN)
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.status) {
    throw new Error(data.message || "Paystack initialize failed");
  }

  return {
    authorizationUrl: data.data.authorization_url,
    reference: data.data.reference,
  };
}

// Server-side confirmation that a transaction actually succeeded —
// never trust the client redirect or the webhook payload alone;
// this call re-checks directly against Paystack using the secret key.
async function verifyTransaction(reference) {
  const res = await fetch(
    `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        Authorization: `Bearer ${getSecretKey()}`,
      },
    },
  );

  const data = await res.json();

  if (!res.ok || !data.status) {
    throw new Error(data.message || "Paystack verify failed");
  }

  return {
    success: data.data.status === "success",
    reference: data.data.reference,
    amount: data.data.amount,
    email: data.data.customer?.email,
    raw: data.data,
  };
}

module.exports = { initializeTransaction, verifyTransaction };
