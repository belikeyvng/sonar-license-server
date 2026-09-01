// lib/issueLicense.js
//
// Ported directly from Sonar's tools/license/issue-license.js. Same
// payload shape, same Ed25519 signing (crypto.sign(null, ...) — Ed25519
// keys don't take a digest algorithm name, unlike RSA/ECDSA). Kept as
// close to the original as possible so a license issued here validates
// against the exact same public_key.pem already shipped in the app
// (src/data/licenses/public_key.pem) with zero client-side changes.
//
// Difference from the original: no CLI plumbing, no file-writing —
// this just returns the signed license object. The caller (the
// webhook handler) decides what to do with it (store it, hand it
// back over HTTP, etc).

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const privateKeyPath = path.join(__dirname, "..", "keys", "private_key.pem");

let privateKey = null;

function loadPrivateKey() {
  if (privateKey) return privateKey;

  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(
      `Private key not found at ${privateKeyPath}. Copy tools/license/keys/private_key.pem here (and only here — never into the Electron app or a public repo).`,
    );
  }

  privateKey = fs.readFileSync(privateKeyPath, "utf8");
  return privateKey;
}

// Same PLANS map as issue-license.js. Only "pro" is actually issued by
// the payment flow today, but kept complete in case a "plus" tier or
// manual issuance is ever needed from this same backend.
const PLANS = {
  free: ["basicVoices"],
  plus: ["basicVoices", "pdf", "advancedVoices"],
  pro: ["basicVoices", "pdf", "advancedVoices", "audioExport"],
};

function issueLicense(plan) {
  if (!PLANS[plan]) {
    throw new Error(`Invalid plan "${plan}". Use: free, plus, or pro.`);
  }

  const key = loadPrivateKey();

  const payload = {
    licenseId: `SONAR-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    plan,
    issuedAt: Date.now(),
    expiresAt: null,
    features: PLANS[plan],
  };

  const payloadString = JSON.stringify(payload);

  const signature = crypto.sign(null, Buffer.from(payloadString, "utf8"), key);

  return {
    payload,
    signature: signature.toString("base64"),
  };
}

module.exports = { issueLicense, PLANS };
