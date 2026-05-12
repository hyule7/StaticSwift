/**
 * _db.js - JSONBin storage with in-memory cache
 * Cache cuts requests by ~90% — reads serve from memory, only writes hit the API
 */

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

// In-memory cache — persists for the lifetime of the function instance
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 30000; // 30 seconds

async function readDB(force = false) {
  if (!BIN_ID || !API_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set');
  const now = Date.now();
  if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
    return _cache;
  }
  const r = await fetch(BASE_URL + '/latest', {
    headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
  });
  if (!r.ok) throw new Error('JSONBin read failed: ' + r.status);
  _cache = await r.json();
  _cacheTime = now;
  return _cache;
}

async function writeDB(data) {
  if (!BIN_ID || !API_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set');
  const r = await fetch(BASE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('JSONBin write failed: ' + r.status);
  // Update cache immediately after write
  _cache = data;
  _cacheTime = Date.now();
  return await r.json();
}

async function getClients() {
  const db = await readDB();
  return Array.isArray(db.clients) ? db.clients : [];
}

async function saveClient(client) {
  const db = await readDB(true); // force fresh read before write
  const clients = Array.isArray(db.clients) ? db.clients : [];
  const idx = clients.findIndex(c => c.clientId === client.clientId);
  if (idx >= 0) { clients[idx] = client; } else { clients.unshift(client); }
  await writeDB({ ...db, clients });
  return client;
}

async function getClient(clientId) {
  const clients = await getClients();
  return clients.find(c => c.clientId === clientId) || null;
}

async function updateClient(clientId, updates) {
  const db = await readDB(true); // force fresh read before write
  const clients = Array.isArray(db.clients) ? db.clients : [];
  const idx = clients.findIndex(c => c.clientId === clientId);
  if (idx < 0) throw new Error('Client not found: ' + clientId);
  clients[idx] = { ...clients[idx], ...updates, clientId };
  await writeDB({ ...db, clients });
  return clients[idx];
}

async function getInvoiceCounter() {
  const db = await readDB();
  return db.invoiceCounter || 0;
}

async function incrementInvoiceCounter() {
  const db = await readDB(true);
  const next = (db.invoiceCounter || 0) + 1;
  await writeDB({ ...db, invoiceCounter: next });
  return next;
}

module.exports = { getClients, saveClient, getClient, updateClient, getInvoiceCounter, incrementInvoiceCounter, readDB, writeDB };
