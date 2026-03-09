#!/usr/bin/env node
// ============================================================
// ENCRYPT.JS — Build script: chiffre les données privées
// Usage: node encrypt.js
// Produit: data-priv.enc.js (blob chiffré) + data.js (public only)
// ============================================================

const crypto = require('crypto');
const fs = require('fs');

const PASSWORD = 'BINGA';
const SALT = 'facturation-azarkan-2025'; // fixed salt for reproducibility

// ---- Private data to encrypt ----
const PRIV_DATA = {
  // Badre commission & taux details
  badre2025: {
    commissionRate: 0.10,
    majalisTaux: [
      { date: "18/08/2025", tauxMarche: 10.505 },
      { date: "12/09/2025", tauxMarche: 10.577 },
      { date: "29/09/2025", tauxMarche: 10.530 },
      { date: "13/11/2025", tauxMarche: 10.768 },
      { date: "11/12/2025", tauxMarche: 10.797 },
      { date: "31/12/2025", tauxMarche: 10.706 },
    ],
  },
  badre2026: {
    tauxApplique: 10.700,
    commissionRate: 0.10,
    majalisTauxMarche: [
      { mois: "Janvier", tauxMarche: 10.836 },
      { mois: "Février", tauxMarche: null },
    ],
  },

  // FX P2P full pipeline data
  fxP2P: {
    title: "Analyse FX — Spreads par étape (EUR → AED → USDT → MAD)",
    subtitle: "Chaque conversion a un spread par rapport au taux marché. L'analyse isole le coût/gain de chaque étape pour quantifier l'avantage du P2P crypto.",
    leg1: {
      label: "EUR → AED (IFX)",
      description: "Conversion bancaire IFX. Spread = taux marché EUR/AED − taux IFX (perte).",
      transactions: [
        { date: "2025-03-28", eur: 10200, aed: 39949.32, tauxIFX: 3.91660, tauxMarche: 3.96465, source: "RTL" },
        { date: "2025-04-17", eur: 17000, aed: 70176.00, tauxIFX: 4.12800, tauxMarche: 4.17329, source: "RTL" },
        { date: "2025-05-23", eur: 17000, aed: 69844.50, tauxIFX: 4.10850, tauxMarche: 4.15630, source: "RTL" },
        { date: "2025-06-16", eur: 19479.78, aed: 81939.75, tauxIFX: 4.20640, tauxMarche: 4.23479, source: "Malt" },
        { date: "2025-07-16", eur: 19479.78, aed: 82265.06, tauxIFX: 4.22310, tauxMarche: 4.26430, source: "Malt" },
        { date: "2025-07-17", eur: 34000, aed: 142922.40, tauxIFX: 4.20360, tauxMarche: 4.26901, source: "RTL" },
        { date: "2025-08-11", eur: 15300, aed: 64605.78, tauxIFX: 4.22260, tauxMarche: 4.28388, source: "RTL" },
        { date: "2025-09-18", eur: 27916.83, aed: 119789.56, tauxIFX: 4.29094, tauxMarche: 4.33766, source: "RTL+Malt" },
        { date: "2025-10-30", eur: 20400, aed: 86167.56, tauxIFX: 4.22390, tauxMarche: 4.26540, source: "RTL" },
        { date: "2025-11-10", eur: 18552.17, aed: 78143.60, tauxIFX: 4.21210, tauxMarche: 4.24469, source: "RTL+Malt" },
        { date: "2025-11-27", eur: 11050, aed: 46585.70, tauxIFX: 4.21590, tauxMarche: 4.26428, source: "RTL" },
        { date: "2025-12-08", eur: 20407.39, aed: 86739.57, tauxIFX: 4.25040, tauxMarche: 4.27929, source: "RTL+Malt" },
        { date: "2025-12-15", eur: 21335, aed: 91313.80, tauxIFX: 4.28000, tauxMarche: 4.31153, source: "RTL" },
        { date: "2026-01-09", eur: 38250, aed: 162658.13, tauxIFX: 4.25250, tauxMarche: 4.27819, source: "RTL" },
        { date: "2026-01-30", eur: 25925, aed: 113185.17, tauxIFX: 4.36587, tauxMarche: 4.37293, source: "RTL" },
        { date: "2026-02-10", eur: 33393.91, aed: 145147.54, tauxIFX: 4.34653, tauxMarche: 4.37533, source: "Malt" },
      ],
    },
    leg2: {
      label: "AED → USDT",
      description: "Achat USDT sur Binance P2P. Spread = premium P2P sur le peg AED/USD.",
      tauxMarche: 3.6725,
      transactions: [
        { date: "2025-06-15", aed: 184.68, usdt: 50.05, prix: 3.690 },
        { date: "2025-06-15", aed: 1000.00, usdt: 271.96, prix: 3.677 },
        { date: "2025-06-16", aed: 372.19, usdt: 100.05, prix: 3.720 },
        { date: "2025-06-16", aed: 2482.00, usdt: 672.62, prix: 3.690 },
        { date: "2025-06-16", aed: 10000.00, usdt: 2710.02, prix: 3.690 },
        { date: "2025-06-16", aed: 5000.00, usdt: 1359.80, prix: 3.677 },
        { date: "2025-06-16", aed: 9000.00, usdt: 2446.98, prix: 3.678 },
        { date: "2025-06-16", aed: 1600.00, usdt: 433.60, prix: 3.690 },
        { date: "2025-06-16", aed: 7500.00, usdt: 2032.52, prix: 3.690 },
        { date: "2025-06-16", aed: 10000.00, usdt: 2717.39, prix: 3.680 },
        { date: "2025-06-18", aed: 7800.00, usdt: 2113.82, prix: 3.690 },
        { date: "2025-06-18", aed: 4500.00, usdt: 1223.49, prix: 3.678 },
        { date: "2025-06-19", aed: 7451.00, usdt: 2019.24, prix: 3.690 },
        { date: "2025-06-20", aed: 6112.00, usdt: 1663.58, prix: 3.674 },
        { date: "2025-06-28", aed: 10000.00, usdt: 2710.76, prix: 3.689 },
        { date: "2025-06-28", aed: 40000.00, usdt: 10843.04, prix: 3.689 },
        { date: "2025-08-09", aed: 2500.00, usdt: 678.05, prix: 3.687 },
        { date: "2025-08-10", aed: 2000.00, usdt: 542.88, prix: 3.684 },
        { date: "2025-12-11", aed: 9334.00, usdt: 2546.09, prix: 3.666 },
        { date: "2026-01-22", aed: 40000.00, usdt: 10893.24, prix: 3.672 },
        { date: "2026-01-22", aed: 30000.00, usdt: 8172.16, prix: 3.671 },
      ],
    },
    leg3: {
      label: "USDT → MAD",
      description: "Vente USDT sur Binance P2P Maroc. Spread = premium P2P sur le cours USD/MAD.",
      tauxMarche: {
        "2025-06-16": 9.1228, "2025-06-24": 9.1170, "2025-06-29": 9.0334,
        "2025-07-12": 9.0094, "2025-07-14": 9.0069, "2025-07-20": 9.0458,
        "2025-07-26": 8.9970, "2025-08-09": 9.0337, "2025-11-02": 9.2893,
        "2026-01-04": 9.1345, "2026-01-22": 9.1864, "2026-01-23": 9.1710,
        "2026-01-27": 9.0794, "2026-01-31": 9.1155,
      },
      transactions: [
        { date: "2025-06-16", usdt: 104.49, mad: 1000.00, prix: 9.570 },
        { date: "2025-06-16", usdt: 939.45, mad: 9000.00, prix: 9.580 },
        { date: "2025-06-16", usdt: 2502.60, mad: 24000.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 521.92, mad: 5000.00, prix: 9.580 },
        { date: "2025-06-16", usdt: 1094.89, mad: 10500.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 1356.99, mad: 13000.00, prix: 9.580 },
        { date: "2025-06-16", usdt: 104.82, mad: 1000.00, prix: 9.540 },
        { date: "2025-06-16", usdt: 62.89, mad: 600.00, prix: 9.540 },
        { date: "2025-06-16", usdt: 157.06, mad: 1500.00, prix: 9.550 },
        { date: "2025-06-16", usdt: 1048.21, mad: 10000.00, prix: 9.540 },
        { date: "2025-06-16", usdt: 521.37, mad: 5000.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 1042.75, mad: 10000.00, prix: 9.590 },
        { date: "2025-06-16", usdt: 631.05, mad: 6051.76, prix: 9.590 },
        { date: "2025-06-16", usdt: 521.37, mad: 5000.00, prix: 9.590 },
        { date: "2025-06-24", usdt: 2105.26, mad: 20000.00, prix: 9.500 },
        { date: "2025-06-29", usdt: 710.49, mad: 6700.00, prix: 9.430 },
        { date: "2025-07-12", usdt: 647.24, mad: 6000.00, prix: 9.270 },
        { date: "2025-07-12", usdt: 1510.24, mad: 14000.00, prix: 9.270 },
        { date: "2025-07-14", usdt: 1377.15, mad: 12780.00, prix: 9.280 },
        { date: "2025-07-14", usdt: 2155.17, mad: 20000.00, prix: 9.280 },
        { date: "2025-07-14", usdt: 1400.86, mad: 13000.00, prix: 9.280 },
        { date: "2025-07-20", usdt: 2575.10, mad: 24000.00, prix: 9.320 },
        { date: "2025-07-26", usdt: 2580.64, mad: 24000.00, prix: 9.300 },
        { date: "2025-08-09", usdt: 1072.96, mad: 10000.00, prix: 9.320 },
        { date: "2025-11-02", usdt: 527.42, mad: 5000.00, prix: 9.480 },
        { date: "2025-11-02", usdt: 527.42, mad: 5000.00, prix: 9.480 },
        { date: "2025-11-02", usdt: 1101.78, mad: 10500.00, prix: 9.530 },
        { date: "2025-11-02", usdt: 550.05, mad: 5241.97, prix: 9.530 },
        { date: "2025-11-02", usdt: 1888.77, mad: 18000.00, prix: 9.530 },
        { date: "2026-01-04", usdt: 1546.39, mad: 15000.00, prix: 9.700 },
        { date: "2026-01-04", usdt: 1030.92, mad: 10000.00, prix: 9.700 },
        { date: "2026-01-22", usdt: 2481.90, mad: 24000.00, prix: 9.670 },
        { date: "2026-01-22", usdt: 2068.25, mad: 20000.00, prix: 9.670 },
        { date: "2026-01-23", usdt: 2061.85, mad: 20000.00, prix: 9.700 },
        { date: "2026-01-23", usdt: 1381.44, mad: 13400.00, prix: 9.700 },
        { date: "2026-01-23", usdt: 1134.02, mad: 11000.00, prix: 9.700 },
        { date: "2026-01-23", usdt: 1853.75, mad: 18000.00, prix: 9.710 },
        { date: "2026-01-27", usdt: 1380.08, mad: 13304.00, prix: 9.640 },
        { date: "2026-01-31", usdt: 1948.71, mad: 19000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 2051.28, mad: 20000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 1641.02, mad: 16000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 2461.53, mad: 24000.00, prix: 9.750 },
        { date: "2026-01-31", usdt: 1500.08, mad: 14625.78, prix: 9.750 },
      ],
    },
    usdtRemaining: 319.71,
  },

  // Ysquare commission info (for Mes Gains)
  ysquareCommission: 0.08,
  ysquareTotal: 54300,
};

// ---- Encrypt with AES-256-GCM ----
async function encrypt() {
  const plaintext = JSON.stringify(PRIV_DATA);

  // Derive key from password using PBKDF2
  const keyMaterial = crypto.pbkdf2Sync(PASSWORD, SALT, 100000, 32, 'sha256');

  // Random IV
  const iv = crypto.randomBytes(12);

  // Encrypt
  const cipher = crypto.createCipheriv('aes-256-gcm', keyMaterial, iv);
  let encrypted = cipher.update(plaintext, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine: iv (12) + tag (16) + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);
  const b64 = combined.toString('base64');

  // Write encrypted data file
  const output = `// Auto-generated — DO NOT EDIT\n// Encrypted private data (AES-256-GCM, PBKDF2)\nconst ENCRYPTED_PRIV = "${b64}";\n`;
  fs.writeFileSync('data-priv.enc.js', output);

  console.log(`Encrypted ${plaintext.length} bytes → ${b64.length} base64 chars`);
  console.log('Written to data-priv.enc.js');
}

encrypt();
