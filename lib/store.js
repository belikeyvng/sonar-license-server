// lib/store.js
//
// Maps a Paystack transaction `reference` -> { status, license }.
// Flat JSON file on disk (chosen for now — swap for a real DB later
// if this ever needs to scale past "one dev testing payments").
//
// Lifecycle per reference:
//   1. initializeTransaction() creates the entry: { status: "pending" }
//   2. webhook verifies payment + issues license: { status: "ready", license }
//   3. app polls GET /license/:reference until status is "ready"

const fs = require("node:fs");
const path = require("node:path");

const dataDir = path.join(__dirname, "..", "data");
const storeFile = path.join(dataDir, "licenses.json");

function ensureDir() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function readAll() {
  ensureDir();
  try {
    const raw = fs.readFileSync(storeFile, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return {};
  }
}

function writeAll(data) {
  ensureDir();
  fs.writeFileSync(storeFile, JSON.stringify(data, null, 2), "utf8");
}

function setPending(reference) {
  const data = readAll();
  data[reference] = { status: "pending", createdAt: Date.now() };
  writeAll(data);
}

function setReady(reference, license) {
  const data = readAll();
  data[reference] = {
    status: "ready",
    license,
    readyAt: Date.now(),
  };
  writeAll(data);
}

function setFailed(reference, reason) {
  const data = readAll();
  data[reference] = {
    status: "failed",
    reason,
    failedAt: Date.now(),
  };
  writeAll(data);
}

function get(reference) {
  const data = readAll();
  return data[reference] || null;
}

module.exports = { setPending, setReady, setFailed, get };
