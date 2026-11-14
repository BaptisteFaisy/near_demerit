# HANDOFF — demerit · passation opencode → Claude (2026-11-12)

> Écrit par **opencode** à la demande de Gaia, qui passe le design à Claude.
> Objet : état des lieux exact, exigences cumulées, et **tout ce qu'il faut faire
> avant la soumission** une fois le design validé et décidé à l'implémenter.
> Règle d'or : **jamais rien inventer**. Si une info manque, demander à Gaia.

---

## 1. Le projet en 8 lignes (le fond est bon, ne pas y toucher)

**demerit** = un **permis professionnel à points** porté par un **NFT non
transférable** sur NEAR. Hackathon NEAR, track **« NFTs That Do Something »**
(Ticket 10). Accroche du dépôt : *« reputation you can lose, not sell »*.

Le jeton fait quatre choses : il **ouvre des portes** (`is_allowed`), il **perd
des points** quand un client signale une mission, il **possède de l'argent**
(une caution qui indemnise directement le client lésé), et il **ne se vend pas**
(`ERR_SOULBOUND`). Le casier suit l'**empreinte d'identité**, pas le compte :
recréer un compte ne remet rien à zéro.

**Dates :** design figé le **14/11** · soumission **15/11 00:59 Paris**.

---

## 2. État des lieux au 2026-11-12 (tout est vérifié, pas estimé)

### Code (owner B — lecture seule pour toi)
- 2 contrats Rust (`contracts/demerit`, `contracts/missions`), 18 tests,
  démo sandbox 9 étapes (`make demo` → `DEMO OK (10/10)`), 7 attaques refusées
  (`make attack`), simulation 5 agents / 24 mois, page publique statique.
- **Les contrats sont déployés sur testnet** (commits du 11/11) :
  registre `ledger.demerit.testnet`, plateforme `platform.demerit.testnet`,
  RPC public `https://rpc.testnet.fastnear.com` (le RPC historique
  `rpc.testnet.near.org` est déprécié → 429). Page publique :
  https://near-demerit.vercel.app . Config : `web/config.js`.
- État live constaté par lecture JSON-RPC (gratuit, sans clé) :
  `lea.demerit.testnet` = **12 pts · active · caution 0,17 / exigée 0,13 ·
  coef 1,25 · fonds 0,02 · crédit client 0,04 · jeton `demerit-1`**.

### Design (owner G)
- Historique V1→V8 rejeté : voir `G-DESIGN/RESTART-CLAUDE.md` (diagnostic des
  échecs + exigences de Gaia + toutes les données réelles du dépôt).
- V9/V10 (autres sessions) : un **jeu jouable** (`planches/v10/`) avec le
  **moteur = portage 1:1 de `rules.rs`** (`moteur.js`, vérifié `RULES OK (23/23)`
  contre les vecteurs Rust par `v10/verify-rules.mjs`).
- **V14 (opencode, 2026-11-12)** : socle neuf dans `planches/v14/` — shell
  moderne (logo + marque + slogan + rail des 6 parties + 11 étapes), moteur
  Three.js (`kit3d.js` : reflets procéduraux, backdrop shader, bloom, grain),
  **3 modes** vérifiés headless sur `31-ecluse.html` :
  - **SCÉNARIO** : `18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | DEMO OK (10/10) | erreurs JS: 0 | chrome 3L/6P/11C/6K/11E`
  - **MANUEL** : `30/30 appels | objectifs 15/15 | attaques refusées 7/7 | I2 ok` (moteur 1:1 jouable)
  - **LIVE** : lecture réelle de la chaîne + intentions signables
    (`near-cli-rs` + lien MyNearWallet via `web/actions.js`), aucune clé côté page.
- Planches 32→40 : **pas encore écrites** (Gaia valide la direction visuelle
  avant). Les captures de revue : `planches/v14/captures/` + `planches/v14/revue.html`.
- `planches/v2/` … `planches/v9/` : planches anciennes, conservées, non utiles
  sauf `v9/src/three/node_modules` (three@0.170 + esbuild@0.24, lié par jonction
  depuis `v14/src/three/node_modules`).

### Blocage connu
- **Le push git est refusé** : `403 — Permission denied to GaiaSG94` sur
  `BaptisteFaisy/near_demerit`. 3 commits sont prêts en local sur la branche
  `design/v9-planches`. → Baptiste doit ajouter `GaiaSG94` en collaborateur
  (ou pousser depuis un poste avec ses identifiants). Ne pas forcer, ne pas
  contourner.

---

## 3. Ce que Gaia veut — exigences cumulées (toutes valables)

### Design (le filtre de toute décision)
1. **Fond sombre, 2 couleurs max** (noir + violet néon — famille validée).
2. **Extrêmement moderne, avant-gardiste** : apparence de **site de design**,
   pas d'un jeu. « Moderne dans les moindres détails ».
3. **3D partout** (Three.js) ; le concept doit être **rendu**, pas décrit.
4. **Fonds très très polishs** et **contenus très polishs** (lumière, matière,
   profondeur, typographie).
5. **Percutant au premier coup d'œil** : on comprend de quoi il s'agit avant
   d'avoir lu un mot. Texte réduit à l'essentiel.
6. **Toutes les parties visibles et identifiables** sur chaque planche :
   ÉMETTEUR (`issuer`), PLATEFORME (`missions`), PROFESSIONNELLE (Léa),
   CLIENT, REGISTRE PUBLIC (`demerit`), FONDS DE GARANTIE.
7. **Le problème / la chose à faire**, en gros, sous forme de **slogan
   percutant et très clair, jamais énigmatique**.
8. **Un logo + le nom du projet/marque**.
9. **Le scénario doit être compréhensible** : dès qu'on appuie sur
   **« lancer un scénario »**, on doit vraiment comprendre toutes les étapes
   (18 temps certifiés, une légende par temps, un terminal sous la scène —
   cette idée est validée).
10. **On doit pouvoir vraiment utiliser la techno** (pas seulement regarder un
    scénario) : c'est un attendu des juges NEAR.
11. **Planches nouvelles et différentes, 10** (Gaia : « /planches nouvelles et
    differentes 10 »). Une seule idée visuelle dominante par planche.
12. Zéro CDN, zéro dépendance réseau (page statique, esbuild embarque Three.js).

### Retours de Gaia du 2026-11-12 (déjà implémentés dans le socle v14 — à garder)
- **Murs transparents** quand la scène a des volumes qui masquent l'action.
- **Sous l'image 3D, une ligne de blocs translucides à angles arrondis** :
  **terminal à gauche**, **benchmarks à droite**, clairement séparés.
- **Bug corrigé** : ne jamais afficher `0,00 / 0,00` au repos — les chiffres
  n'apparaissent qu'une fois le scénario lancé (ou en mode manuel/live).

---

## 4. À faire avant la soumission (checklist ordonnée)

### A. Design (Claude + Gaia) — au plus tard le 14/11
- [ ] Gaia valide une direction visuelle (`/lock`).
- [ ] **Les 10 planches finales** construites sur le socle v14 (ou sur ton
      propre socle si tu le justifies) : `planches/v14/NN-nom.html` +
      sommaire `index.html` qui les présente.
- [ ] Chaque planche coche les 8 cases : logo + marque · slogan explicite ·
      3D polie + fond poli · les 6 parties · les 6 natures d'interaction
      (transaction / vue gratuite / inter-contrats / paiement / refus / hors
      chaîne) · les 18 temps jouables jusqu'au bout · terminal sous la scène ·
      benchmarks visibles.
- [ ] **Mode MANUEL + mode LIVE** présents sur les planches finales (« utiliser
      la techno ») — le socle v14 les fournit (`manuel.js`, `live.js`,
      `moteur.js`, `actions.js`).
- [ ] **Vérification obligatoire** avant de dire « c'est fait » (jamais sans
      l'avoir exécuté) :

```
cd G-DESIGN/planches/v14/src/three
node build.mjs          # construit les planches
node ..\verify.mjs --manuel --live --shots=1:2600,5b:2600,10
```

Lignes attendues par planche :
```
OK NN-nom.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | … | erreurs JS: 0 | chrome 3L/6P/11C/6K/11E
OK NN-nom.html MANUEL | 30/30 appels | objectifs 15/15 | attaques refusées 7/7 | I2 ok | …
OK NN-nom.html LIVE | ledger.demerit.testnet | état … | jeton demerit-1
```
Puis **ouvrir les PNG** `captures/*.png` et itérer au moins deux fois.
(Gaia ne peut pas lire les images à ta place : montre-lui `revue.html`.)

### B. Livrables de soumission (à préparer dès que le design est figé)
- [ ] **Vidéo démo** (obligatoire, postée sur X) : scénario + mode manuel + live.
      Durée et format : **à confirmer par Gaia** (ne pas inventer).
- [ ] **Post X** (obligatoire) : accroche + lien. Brouillon à valider par Gaia.
- [ ] **Repo public propre** : `git push` (après déblocage collaborateur) des
      planches + `DESIGN.md` + `STATUS.md` ; **aucun secret** (règle absolue) ;
      `.gitignore` de `planches/v14/` exclut `captures/` et `node_modules/`.
- [ ] **`STATUS.md` à jour** (phase, état, round, horodatage, section auteur).
- [ ] **`DESIGN.md`** : la direction finale documentée (tu es propriétaire).
- [ ] Vérifier la **cohérence** entre le design retenu et la page publique
      https://near-demerit.vercel.app (même produit, mêmes noms).
- [ ] Soumission sur la plateforme du hackathon **avant le 15/11 00:59 Paris**.

### C. Risques ouverts
- Push git bloqué (403) — voir §2. Prévenir Gaia/Baptiste maintenant.
- Le déploiement testnet existe mais `missions` / `ledger` n'ont peut-être pas
  toutes les données du scénario amorcé : le mode LIVE se contente de **lire**
  (c'est volontaire : la page ne détient aucune clé).
- Chrome headless quitte parfois avec un code non nul après `--dump-dom` :
  `verify.mjs` le tolère (le DOM reste exploitable). Ne pas le « corriger ».

---

## 5. Fichiers à lire (dans cet ordre)

```
HACKATONS/CLAUDE.md                                  ← tes consignes permanentes
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/RESTART-CLAUDE.md
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/BRIEF-UI.md
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/STATUS.md   ← état complet V1→V14
HACKATONS/2026-11-15-near/NFTs/demerit/README.md
HACKATONS/2026-11-15-near/NFTs/demerit/docs/SPEC.md         ← cahier des charges
HACKATONS/2026-11-15-near/NFTs/demerit/docs/ABI.md          ← signatures figées
HACKATONS/2026-11-15-near/NFTs/demerit/demo/src/main.rs     ← les 9 étapes réelles
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/planches/v14/src/core.js    ← scénario 18 temps (données = vérité)
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/planches/v14/src/three/kit3d.js  ← le kit 3D réutilisable
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/planches/v14/src/manuel.js  ← mode jouable (moteur 1:1)
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/planches/v14/src/live.js    ← mode testnet
HACKATONS/2026-11-15-near/NFTs/demerit/G-DESIGN/planches/v14/src/three/31-ecluse.js ← planche de référence
```

## 6. Règles de propriété (rappel)

- Tu écris : `DESIGN.md`, les planches, ta section `## Claude` de `STATUS.md`,
  les prompts de génération.
- Tu ne touches **jamais** au code (`contracts/`, `demo/`, `web/`, `scripts/`),
  aux tests, aux workflows, ni au Google Sheet. Le repo de code est en
  lecture seule ; le déploiement testnet est de Baptiste.
- Tout run à secrets passe par `HACKATONS/tools/with-secrets.ps1` ; jamais de
  valeur affichée, loggée ou commitée.
- Si une info manque (durée de la vidéo, format de la soumission, contenu du
  post X) : **demander à Gaia**, ne pas l'inventer.

---

## 7. PROMPT RELAIS À COLLER DANS TON CHAT

```
Projet : demerit — hackathon NEAR, track « NFTs That Do Something » (Ticket 10).
Design figé le 14/11 · soumission 15/11 00:59 Paris.

Tu prends le design au vol : Gaia valide ta direction visuelle, puis il te dit
de l'implémenter. Avant ça, et avant toute soumission, lis D'ABORD :
1. HACKATONS/CLAUDE.md (tes consignes permanentes)
2. G-DESIGN/HANDOFF-CLAUDE.md  ← CE FICHIER : état des lieux exact, exigences
   cumulées de Gaia, et la checklist complète « à faire avant la soumission ».
3. G-DESIGN/RESTART-CLAUDE.md (diagnostic des échecs V1→V8 + toutes les
   données réelles du dépôt : barème, scénario 9 étapes, comptes, vues, codes)
4. G-DESIGN/STATUS.md (V1→V14, vérifications déjà exécutées)

Ce que Gaia veut, en une phrase : un site de DESIGN avant-gardiste en 3D,
moderne dans les moindres détails (fonds très polishs), qui fait comprendre le
produit d'un coup d'œil — jamais un jeu — avec un slogan percutant, un logo,
les 6 parties visibles, un scénario qu'on comprend vraiment quand on appuie sur
« lancer », et la possibilité de VRAIMENT utiliser la techno (bac à sable
jouable + testnet live).

Exigences non négociables : fond sombre + violet néon (2 couleurs max) · 3D
partout · slogans explicites (jamais énigmatiques) · logo + marque · les 6
parties sur chaque planche · les 6 natures d'interaction lisibles · les 18
temps du scénario certifié jouables jusqu'au bout · terminal sous la scène ·
benchmarks · 10 planches NOUVELLES et DIFFÉRENTES · zéro CDN · jamais de
`0,00 / 0,00` au repos.

Le socle technique existe et est vérifié (G-DESIGN/planches/v14/) : shell,
kit Three.js, moteur 1:1 jouable (MANUEL : 30/30 appels, 15/15 objectifs,
7/7 attaques), mode LIVE sur les contrats déployés (ledger.demerit.testnet),
build + vérification headless Chrome (build.mjs, verify.mjs). Réutilise-le ou
remplace-le, mais VÉRIFIE : `node build.mjs` puis
`node ..\verify.mjs --manuel --live --shots=…` et ouvre les PNG.
Ne dis jamais « c'est fait » sans l'avoir exécuté.

Avant la soumission : checklist §4 de HANDOFF-CLAUDE.md (10 planches, vidéo,
post X — durée/format à demander à Gaia, repo propre, STATUS.md, DESIGN.md,
push git — actuellement bloqué 403 pour GaiaSG94 : signalé, ne pas forcer).

Commandes : /planches /variantes /delta /cible /compare /lock
```

— opencode, 2026-11-12. Bonne chance, Claude.

---

## [opencode] 2026-11-14 — main figé côté opencode, le tag peut être posé

**Rien en vol : `main` est prêt pour `hackathon-submission`.** Vérifié le 14/11
à 15:12 (Paris) :

- `gh pr list` sur `Tradoooo/near_demerit` : **aucune PR ouverte** (brouillons
  compris) ; `git ls-remote --heads origin` : **`main` seule** ;
- dernier merge : **#5** (`fix(web): le terminal live lit les vrais reçus`),
  14/11 13:58 UTC — `main` = **`af3e186`** ;
- la chaîne P0 (tableau de bord) → P3 (vidéo) est **atterrée** :
  `web/dashboard.html`, `web/app.html` et `web/index.html` sont sur `main` ;
- la vidéo du dépôt n'est plus l'ancienne : `G-DESIGN/video/demerit-demo.mp4`
  a été re-tournée sur le design Blueprint le **13/11 à 18:18** (« video: V3 —
  le film re-tourne sur le design Blueprint en ligne »). La ligne « vidéo à
  refaire » de `STATUS.md` est antérieure (17:36) : **périmée**.

**Tag** : Baptiste peut le poser sur `af3e186`. Aucune PR ne sera plus ouverte
côté opencode avant la clôture ; si un correctif devenait indispensable, il
serait annoncé ici avant 22:30 (Paris).

**Le pack de soumission** n'est pas versionné et n'a pas à l'être :
`pour-baptiste-soumission/` (zip du 14/11 14:37, dans `~/Téléchargements`)
est une livraison pour Baptiste — README, deux vidéos, post X, formulaire,
vérifications.
