/**
 * _db.js - Simple JSONBin-based storage
 * 
 * Setup (one time):
 * 1. Go to https://jsonbin.io and create a free account
 * 2. Create a new bin with initial content: {"clients": []}
 * 3. Copy the Bin ID and your Master Key
 * 4. Add to Netlify environment variables:
 *    JSONBIN_BIN_ID   = your bin ID (e.g. 64abc123...)
 *    JSONBIN_API_KEY  = your master key (e.g. $2a$10$...)
 */

const BIN_ID = process.env.JSONBIN_BIN_ID;
const API_KEY = process.env.JSONBIN_API_KEY;
const BASE_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

async function readDB() {
  if (!BIN_ID || !API_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set in Netlify');
  const r = await fetch(BASE_URL + '/latest', {
    headers: { 'X-Master-Key': API_KEY, 'X-Bin-Meta': 'false' }
  });
  if (!r.ok) throw new Error('JSONBin read failed: ' + r.status);
  return await r.json(); // returns { clients: [...] }
}

async function writeDB(data) {
  if (!BIN_ID || !API_KEY) throw new Error('JSONBIN_BIN_ID and JSONBIN_API_KEY env vars not set in Netlify');
  const r = await fetch(BASE_URL, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Master-Key': API_KEY },
    body: JSON.stringify(data)
  });
  if (!r.ok) throw new Error('JSONBin write failed: ' + r.status);
  return await r.json();
}

async function getClients() {
  const db = await readDB();
  return Array.isArray(db.clients) ? db.clients : [];
}

async function saveClient(client) {
  const db = await readDB();
  const clients = Array.isArray(db.clients) ? db.clients : [];
  const idx = clients.findIndex(c => c.clientId === client.clientId);
  if (idx >= 0) {
    clients[idx] = client; // update
  } else {
    clients.unshift(client); // add new at top
  }
  await writeDB({ ...db, clients });
  return client;
}

async function getClient(clientId) {
  const clients = await getClients();
  return clients.find(c => c.clientId === clientId) || null;
}

async function updateClient(clientId, updates) {
  const db = await readDB();
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
  const db = await readDB();
  const next = (db.invoiceCounter || 0) + 1;
  await writeDB({ ...db, invoiceCounter: next });
  return next;
}

module.exports = { getClients, saveClient, getClient, updateClient, getInvoiceCounter, incrementInvoiceCounter, readDB, writeDB };
