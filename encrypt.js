#!/usr/bin/env node
// ============================================================
// ENCRYPT.JS — Build script: chiffre TOUTES les données
// Usage: node encrypt.js
// Produit:
//   data-enc.js      → ENCRYPTED_FULL (TIGRE) + ENCRYPTED_BENOIT (COUPA)
//   data-priv.enc.js → ENCRYPTED_PRIV (BINGA private overlay)
//
// ARCHITECTURE & CONVENTIONS:
// ---------------------------
// Augustin (Augustin) 2026:
//   - tauxMaroc = 10.26 (= PERSO_FACTOR × 10.8 = 0.95 × 10.8)
//   - PERSO_FACTOR = 0.95 → 1000€ pro = 950€ perso = 10 260 MAD
//   - Positions: Pro → Perso = Pro × 0.95 → MAD = Pro × 10.26
//   - report2025 = -1683 (carryforward clôture 2025)
//   - Divers: montant = PERSO (cash réel). Pro = montant ÷ 0.95
//     Si proOrigin: true → montant = PRO, Perso = montant × 0.95
//     (actuellement aucun item n'a proOrigin)
//
// Benoit (Badre) 2026:
//   - commissionRate = 0.10 (10% Amine), tvaRate = 0.21
//   - Tracking en DH. Taux appliqué = 10.6 (fixe 2026)
//   - Position = report2025 + netPaid26 - totalPaye26
//   - Fonction partagée: computeBenoitSolde() dans render-helpers.js
//
// Divers 2026 (3 transactions perso):
//   1. Oumaima → Augustin: +800€ (remboursement reçu)
//   2. Augustin → Amine (via Zakaria): -1200€ (avance)
//   3. Amine → Augustin (via Nezha → Hanane): +6000€ (virement perso)
//   Net = 5 600€ perso
// ============================================================

const crypto = require('crypto');
const fs = require('fs');

const SALT = 'facturation-augustin-2025'; // fixed salt for reproducibility

// ============================================================
// NICK — real→alias mapping. Lives ONLY inside the encrypted blobs (injected at
// runtime by render-helpers.applyNick). NEVER hardcode real names in the public
// served JS. Each blob carries ONLY the aliases its tab needs (isolation): the
// Benoit blob has no Bob entries and vice-versa, so an authenticated counterparty
// can't decode the others' identities.
//   map     = exact-match lookup for nick(beneficiaire)
//   replace = ordered free-text patterns for nickText() (LONGEST match first)
// Family first-names (Amine/Nezha/Hanane) pass through unchanged (no entry needed).
// ============================================================
// ── DONNÉES : HORS DÉPÔT ─────────────────────────────────────────────────────
// Elles étaient inline ici, dans un dépôt PUBLIC. Elles vivent désormais dans un
// fichier gardé hors du dépôt, comme la source de networth. Ce script n'en contient
// plus que la logique de chiffrement, qui n'a rien de secret.
const SOURCE = process.env.FACT_DATA_SOURCE
  || require('path').join(require('os').homedir(), 'facturation-data', 'source.js');
if (!fs.existsSync(SOURCE)) {
  console.error('✗ Source introuvable : ' + SOURCE);
  console.error('  Les données en clair vivent hors du dépôt. Renseigne FACT_DATA_SOURCE si besoin.');
  process.exit(1);
}
const {
  NICK_FULL, NICK_BEN, NICK_BOB,
  FULL_DATA, BENOIT_DATA, BOB_DATA, PRIV_DATA,
} = require(SOURCE);

// ============================================================
function encryptData(data, password) {
  const plaintext = JSON.stringify(data);
  const normalizedPwd = password.toUpperCase();

  // Derive key
  const keyMaterial = crypto.pbkdf2Sync(normalizedPwd, SALT, 100000, 32, 'sha256');

  // Random IV
  const iv = crypto.randomBytes(12);

  // Encrypt
  const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine: iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  return combined.toString('base64');
}

// ============================================================
// Main — Generate encrypted data files
// ============================================================
async function main() {
  console.log('Encrypting all data...\n');

  // 1) Full data → TIGRE
  const fullB64 = encryptData(FULL_DATA, 'TIGRE');
  console.log(`FULL (TIGRE): ${JSON.stringify(FULL_DATA).length} bytes → ${fullB64.length} base64 chars`);

  // 2) Benoit-only → COUPA
  const benoitB64 = encryptData(BENOIT_DATA, 'COUPA');
  console.log(`BENOIT (COUPA): ${JSON.stringify(BENOIT_DATA).length} bytes → ${benoitB64.length} base64 chars`);

  // 3) Bob-only → TESLA (Hamza logs in, sees only his own tab)
  const bobB64 = encryptData(BOB_DATA, 'TESLA');
  console.log(`BOB (TESLA): ${JSON.stringify(BOB_DATA).length} bytes → ${bobB64.length} base64 chars`);

  // 4) Private overlay → BINGA
  const privB64 = encryptData(PRIV_DATA, 'BINGA');
  console.log(`PRIV (BINGA): ${JSON.stringify(PRIV_DATA).length} bytes → ${privB64.length} base64 chars`);

  // Write data-enc.js (main encrypted blobs)
  const encOutput = `// Auto-generated — DO NOT EDIT
// Encrypted main data (AES-256-GCM, PBKDF2, password uppercased)
const ENCRYPTED_FULL = "${fullB64}";
const ENCRYPTED_BENOIT = "${benoitB64}";
const ENCRYPTED_BOB = "${bobB64}";
`;
  fs.writeFileSync('data-enc.js', encOutput);
  console.log('\n→ Written to data-enc.js');

  // Write data-priv.enc.js (private overlay)
  const privOutput = `// Auto-generated — DO NOT EDIT
// Encrypted private data (AES-256-GCM, PBKDF2, password uppercased)
const ENCRYPTED_PRIV = "${privB64}";
`;
  fs.writeFileSync('data-priv.enc.js', privOutput);
  console.log('→ Written to data-priv.enc.js');

  console.log('\nDone. Remember to remove data.js from the repo (data is now encrypted).');
}

main();
