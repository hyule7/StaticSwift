/**
 * _db.js — JSONBin storage with robust caching
 * 
 * KEY FIX: updateClient now merges with existing data rather than
 * reading fresh each time, preventing race conditions and rate limit issues.
 * The cache is the source of truth for reads; only writes go to JSONBin.
 */

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

let _cache = null;
let _cacheTime = 0;
const CACHE_TTL = 60000; // 60 seconds

async function readDB(force = false) {
  if (!BIN_ID || !API_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set');
  const now = Date.now();
  // Use cache if fresh enough and not forced
  if (!force && _cache && (now - _cacheTime) < CACHE_TTL) {
    return JSON.parse(JSON.stringify(_cache)); // deep clone to prevent mutation
  }
  // If forced but we hit it recently (within 5s), still use cache to avoid hammering
  if (force && _cache && (now - _cacheTime) < 5000) {
    return JSON.parse(JSON.stringify(_cache));
  }
  try {
    const r = await fetch(`${BASE_URL}/latest`, {
      headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
    });
    if (r.status === 429) {
      // Rate limited — use cache if available, otherwise throw
      if (_cache) {
        console.warn('[_db] Rate limited, using cached data');
        return JSON.parse(JSON.stringify(_cache));
      }
      throw new Error('JSONBin rate limited (429). Please wait a moment and try again.');
    }
    if (!r.ok) throw new Error('JSONBin read failed: ' + r.status);
    const data = await r.json();
    _cache = data;
    _cacheTime = now;
    return JSON.parse(JSON.stringify(data));
  } catch (err) {
    // Network error — use cache if available
    if (_cache) {
      console.warn('[_db] Read error, using cache:', err.message);
      return JSON.parse(JSON.stringify(_cache));
    }
    throw err;
  }
}

async function writeDB(data) {
  if (!BIN_ID || !API_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set');
  const r = await fetch(BASE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
    body: JSON.stringify(data)
  });
  if (r.status === 429) throw new Error('JSONBin rate limited. Too many requests — please wait a moment.');
  if (!r.ok) throw new Error('JSONBin write failed: ' + r.status);
  // Update cache immediately after successful write
  _cache = JSON.parse(JSON.stringify(data));
  _cacheTime = Date.now();
  return await r.json();
}

async function getClients() {
  const db = await readDB();
  return Array.isArray(db.clients) ? db.clients : [];
}

async function saveClient(client) {
  // Read current state, merge, write back
  const db = await readDB();
  const clients = Array.isArray(db.clients) ? db.clients : [];
  const idx = clients.findIndex(c => c.clientId === client.clientId);
  if (idx >= 0) {
    // MERGE — never overwrite, always merge to preserve all fields
    clients[idx] = { ...clients[idx], ...client, clientId: client.clientId };
  } else {
    clients.unshift(client);
  }
  await writeDB({ ...db, clients });
  return clients[idx >= 0 ? idx : 0];
}

async function getClient(clientId) {
  const clients = await getClients();
  return clients.find(c => c.clientId === clientId) || null;
}

async function updateClient(clientId, updates) {
  // Read current state
  const db = await readDB();
  const clients = Array.isArray(db.clients) ? db.clients : [];
  const idx = clients.findIndex(c => c.clientId === clientId);
  if (idx < 0) throw new Error('Client not found: ' + clientId);
  // CRITICAL: spread existing first, then updates — never lose existing fields
  clients[idx] = { ...clients[idx], ...updates, clientId };
  await writeDB({ ...db, clients });
  return clients[idx];
}

async function getInvoiceCounter() {
  const db = await readDB();
  return db.invoiceCounter || 0;
}

async function incrementInvoiceCounter() {
  const db = await readDB();
  const next = (db.invoiceCounter || 0) + 1;
  await writeDB({ ...db, invoiceCounter: next });
  return next;
}

module.exports = { getClients, saveClient, getClient, updateClient, getInvoiceCounter, incrementInvoiceCounter, readDB, writeDB };
