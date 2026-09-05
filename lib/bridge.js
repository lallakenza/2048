// ============================================================================
// bridge.js — CONTRAT D'INTÉGRATION publié vers Networth.
//
// POURQUOI UN ARTEFACT. Networth lisait `localStorage.facturation_positions`, écrit
// par le rendu de 2048. Conséquence : tant que personne n'avait ouvert 2048 et saisi
// le mot de passe, Networth travaillait sur un instantané périmé sans le savoir.
// L'artefact est produit au build, versionné et daté : il se lit sans dépendre d'une
// visite préalable, et il porte de quoi juger sa propre fraîcheur (`dataAsOf`).
//
// BRUT ≠ COMPENSÉ. `positionsGross` est la seule vérité comptable. La compensation
// Augustin/Bob est publiée à part, en SCÉNARIO : elle décrit un règlement qui n'a pas
// eu lieu. Tant qu'Azarkan n'a pas retransmis à Hamza, la créance sur l'un et la dette
// envers l'autre coexistent. Les confondre ferait disparaître une exposition réelle.
//
// UMD : `require()` en Node (build) et `window.construirePont` au navigateur (pont
// localStorage de compatibilité) — une seule implémentation, donc aucune divergence
// possible entre ce qui est affiché et ce qui est publié.
// ============================================================================
(function (racine, fabrique) {
  const api = fabrique();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') Object.assign(window, api);
})(this, function () {

  const SCHEMA_VERSION = '1.0.0';
  const DEVISE = 'MAD';

  /** Statuts de règlement rencontrés, comptés par catégorie + détail des non-acquis. */
  function etatDesPreuves(DATA) {
    // `non_regle` = pas de bloc ET pas marquée payée : c'est un état normal, pas une
    // anomalie. `sans_bloc` = marquée payée SANS bloc : ça, c'est une anomalie (le
    // validateur la refuse déjà), et le pont doit la rendre visible en aval.
    const compte = { paye: 0, paye_non_verifie: 0, inconnu: 0, en_attente: 0, non_regle: 0, sans_bloc: 0 };
    const aTraiter = [];
    const vu = new Set();
    const visiter = (o) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(visiter); return; }
      if (typeof o.ref === 'string' && (o.montant != null || o.htEUR != null || o.eur != null)) {
        if (!vu.has(o.ref)) {
          vu.add(o.ref);
          const r = o.reglement;
          const marqueePayee = /paid|payé|payee|encaiss/i.test(String(o.statutText || '')) || o.statut === 'ok';
          const st = r && r.statut ? r.statut : (marqueePayee ? 'sans_bloc' : 'non_regle');
          if (compte[st] != null) compte[st]++; else compte.sans_bloc++;
          if (st === 'paye_non_verifie' || st === 'inconnu' || st === 'sans_bloc') {
            aTraiter.push({ ref: o.ref, statut: st, preuve: (r && r.preuve) || null, date: (r && r.date) || null });
          }
        }
      }
      for (const v of Object.values(o)) if (v && typeof v === 'object') visiter(v);
    };
    visiter(DATA);
    return { compte, aTraiter };
  }

  /** Échéances encore ouvertes, tous flux confondus. */
  function echeancesOuvertes(DATA) {
    const out = [];
    const visiter = (o, contrepartie) => {
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach(x => visiter(x, contrepartie)); return; }
      const r = o.reglement;
      if (typeof o.ref === 'string' && r && r.statut === 'en_attente') {
        out.push({
          ref: o.ref, contrepartie,
          montant: o.montant != null ? o.montant : o.htEUR,
          devise: 'EUR', echeance: o.dateDue || null, statut: 'en_attente',
        });
      }
      for (const [k, v] of Object.entries(o)) if (v && typeof v === 'object') visiter(v, contrepartie);
    };
    visiter(DATA.augustin2026, 'augustin');
    visiter(DATA.benoit2026, 'benoit');
    visiter(DATA.bob2026, 'bob');
    return out.sort((a, b) => String(a.echeance).split('/').reverse().join('').localeCompare(String(b.echeance).split('/').reverse().join('')));
  }

  /**
   * Compensation Augustin ⇄ Bob — SCÉNARIO, jamais comptabilisé.
   * Applicable seulement si les deux positions sont de sens opposés ; on transfère
   * min(|a|,|b|) pour amener la plus petite à zéro. La somme reste invariante.
   */
  function scenarioCompensation(a, b, bo) {
    const eligible = (a > 0) !== (bo > 0) && Math.round(a) !== 0 && Math.round(bo) !== 0;
    if (!eligible) {
      return { applicable: false, montantMAD: 0, base: 'augustin<->bob',
               augustin: a, benoit: b, bob: bo, total: a + b + bo,
               note: 'Positions de même sens — rien à compenser.' };
    }
    const aPlusPetit = Math.abs(a) <= Math.abs(bo);
    return {
      applicable: true, montantMAD: Math.round(Math.min(Math.abs(a), Math.abs(bo))),
      base: 'augustin<->bob',
      augustin: aPlusPetit ? 0 : a + bo,
      benoit: b,
      bob: aPlusPetit ? a + bo : 0,
      total: a + b + bo,
      note: "Scénario non exécuté : Azarkan est le canal du dispatch de Bob, mais tant qu'il n'a pas retransmis, la créance sur lui et la dette envers Bob coexistent. Ne pas comptabiliser.",
    };
  }

  /**
   * @param {object} DATA     jeu complet, overlay PRIV déjà appliqué
   * @param {object} helpers  { computeAugustinPosition, computeBenoitSolde, computeBobSolde }
   * @param {object} opts     { sourceVersion }
   */
  function construirePont(DATA, helpers, opts) {
    const o = opts || {};
    const az = helpers.computeAugustinPosition();
    const ba = helpers.computeBenoitSolde();
    const bo = helpers.computeBobSolde();

    // Convention : positif = la contrepartie doit à Amine.
    const aMAD = Math.round(-az.posNetMAD);
    const bMAD = Math.round(-ba.solde);
    const oMAD = Math.round(-bo.solde);
    const tauxAz = (DATA.augustin2026 && DATA.augustin2026.tauxMaroc) || 10.26;
    const TAUX_DH = 10.6; // Benoit et Bob sont suivis en dirham à taux contractuel fixe

    const positionsGross = {
      augustin: { libelle: 'Augustin', signedMAD: aMAD, signedEUR: Math.round(-az.posNetPerso), taux: tauxAz },
      benoit:   { libelle: 'Benoit',   signedMAD: bMAD, signedEUR: Math.round(bMAD / TAUX_DH), taux: TAUX_DH },
      bob:      { libelle: 'Bob',      signedMAD: oMAD, signedEUR: Math.round(oMAD / TAUX_DH), taux: TAUX_DH },
      total:    { signedMAD: aMAD + bMAD + oMAD,
                  signedEUR: Math.round(-az.posNetPerso) + Math.round(bMAD / TAUX_DH) + Math.round(oMAD / TAUX_DH) },
    };

    const preuves = etatDesPreuves(DATA);

    return {
      schemaVersion: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      // Dérivée des opérations, jamais saisie : une date dérivée ne peut pas prétendre
      // une fraîcheur que les données n'ont pas.
      dataAsOf: (DATA._meta && DATA._meta.derniereOperation) || o.dataAsOf || null,
      sourceVersion: o.sourceVersion || null,
      currency: DEVISE,
      positionsGross,
      positionsNettingScenario: scenarioCompensation(aMAD, bMAD, oMAD),
      dueDates: echeancesOuvertes(DATA),
      evidenceStatus: preuves,
    };
  }

  /**
   * Artefact MINIMAL publié à /data/networth-bridge.json.
   *
   * Volontairement pauvre : positions agrégées seulement, AUCUNE facture, aucune
   * contrepartie nommée au-delà de l'alias, aucun montant unitaire. C'est ce qui rend
   * acceptable sa publication en clair — un consommateur inter-applications a besoin
   * des soldes, pas du détail des pièces.
   *
   * `nettingApplied: false` est explicite et non négociable : la compensation
   * Augustin/Bob est théorique tant qu'Azarkan n'a pas retransmis. Un consommateur
   * qui lirait des positions déjà compensées effacerait une exposition réelle.
   */
  function pontMinimal(pontComplet) {
    const g = pontComplet.positionsGross;
    return {
      schemaVersion: SCHEMA_VERSION,
      producerVersion: pontComplet.sourceVersion,
      generatedAt: pontComplet.generatedAt,
      dataAsOf: pontComplet.dataAsOf,
      currency: DEVISE,
      signConvention: 'positif = le tiers doit à Amine ; négatif = Amine doit au tiers',
      positionsGross: {
        augustin: g.augustin.signedMAD,
        benoit: g.benoit.signedMAD,
        bob: g.bob.signedMAD,
      },
      netPositionMad: g.total.signedMAD,
      nettingApplied: false,
    };
  }

  /**
   * Validation de schéma + tests de formule sur l'artefact minimal.
   * @returns {{ok: boolean, erreurs: string[]}}
   */
  function validerPontMinimal(a) {
    const e = [];
    const estEntier = (v) => typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v);
    const champs = {
      schemaVersion: 'string', producerVersion: 'string', generatedAt: 'string',
      dataAsOf: 'string', currency: 'string', signConvention: 'string',
    };
    for (const [c, t] of Object.entries(champs)) {
      if (typeof a[c] !== t || !a[c]) e.push(`champ « ${c} » absent ou non ${t}`);
    }
    if (a.currency !== 'MAD') e.push(`devise « ${a.currency} » — le contrat impose MAD`);
    if (a.nettingApplied !== false) e.push('nettingApplied doit être false : la compensation est théorique');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.dataAsOf || '')) e.push('dataAsOf doit être au format AAAA-MM-JJ');
    if (!a.signConvention || !/positif/.test(a.signConvention)) e.push('convention de signe non documentée');
    if (!a.positionsGross || typeof a.positionsGross !== 'object') {
      e.push('positionsGross absent');
    } else {
      for (const k of ['augustin', 'benoit', 'bob']) {
        if (!estEntier(a.positionsGross[k])) e.push(`positionsGross.${k} doit être un entier MAD`);
      }
      // FORMULE : le net publié doit être exactement la somme des trois positions.
      const somme = a.positionsGross.augustin + a.positionsGross.benoit + a.positionsGross.bob;
      if (!estEntier(a.netPositionMad)) e.push('netPositionMad doit être un entier');
      else if (somme !== a.netPositionMad) {
        e.push(`netPositionMad (${a.netPositionMad}) ≠ somme des positions (${somme})`);
      }
    }
    return { ok: e.length === 0, erreurs: e };
  }

  return { construirePont, scenarioCompensation, etatDesPreuves, echeancesOuvertes,
           pontMinimal, validerPontMinimal, SCHEMA_VERSION };
});
