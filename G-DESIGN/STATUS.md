# STATUS — demerit · G-DESIGN

## Claude

- **Phase** : V10 — la planche est devenue **un jeu jouable**
- **Round** : V10 (2026-11-11) — `planches/v10/`, servi en HTTP local
- **Livrable** : `planches/v10/index.html` (+ `moteur.js`, `sources.js`,
  `scene.js`, `jeu.js`, `app.js`, `style.css`, `serve.mjs`)
- **Lancer** : `node planches/v10/serve.mjs 8099` → `http://127.0.0.1:8099/`
  (`?auto=1` déroule le scénario seul, pour la capture vidéo)

### Ce qui a changé

- **Le moteur est le contrat.** `moteur.js` est un portage 1:1 de
  `rules.rs` + `record.rs` + `logic_holder.rs` + `logic_issuer.rs` +
  `missions/lib.rs` : calcul paresseux, barème, caution, bonus-malus,
  casier par empreinte, délégations, recours, invariant I2. Chaque clic
  exécute la vraie logique et renvoie le **vrai code de refus**.
- **Deux modes, un seul site.** `sources.js` expose la même forme de données
  depuis `SandboxSource` (moteur local) ou `RpcSource` (JSON-RPC testnet).
  Les panneaux et la scène ignorent la provenance. Réponse à la question de
  Gaia : simulation et réel **sur le même site**, avec un badge permanent
  « BAC À SABLE » pour éviter la confusion.
- **On joue les 5 rôles** : émetteur, plateforme, professionnelle, client,
  registre (lectures). 24 actions réelles, grisées tant que la précondition
  manque.
- **15 objectifs** à cocher (délivrer, travailler, encaisser une faute,
  voir le temps réparer, tomber à zéro, être indemnisé, être refusé,
  prouver que le casier suit, prouver l'invendabilité, revenir, I2…).
- **Les 7 attaques de `make attack` sont cliquables** : le joueur essaie de
  casser le contrat et le contrat refuse, avec le code.
- **Scène 3D recomposée** : la porte est passée au premier plan (le seuil à
  franchir), le fonds au milieu-droite, les étiquettes des nœuds bas sont
  passées sous leurs nœuds. Plus aucun chevauchement non voulu.

### Bug majeur trouvé et corrigé

`iso()` était appelé avec un tableau au lieu de `(x, y, z)` →
**58 polygones sur 67 rendaient `NaN`**. Toutes les scènes 3D depuis la V5
étaient donc largement invisibles. Corrigé : `iso()` accepte les deux formes.
C'est très probablement la cause du « pas assez visuel / catastrophique ».

Bug annexe corrigé : les animations en `requestAnimationFrame` ne tournaient
pas sans compositeur (headless, onglet en arrière-plan) → filet `setTimeout`.

### Vérifications (exécutées, pas estimées)

- `node --check` sur les 5 scripts : OK.
- **Scénario complet en headless Chrome** : 15/15 objectifs, **7/7 attaques
  refusées**, invariant I2 exact (1,65 = 1,65), état final pts 6 · cap 6 ·
  caution 1,25 = exigée 1,25 · coef 125 · fonds 0,20 · invalidations 1 ·
  titre « Coursier · 6/6 · probatoire », 83 lignes de terminal,
  **0 erreur JS**, 71 polygones valides / **0 NaN**.
- **Sonde géométrique** : 9 groupes mesurés, aucun chevauchement non voulu
  (registre/carte/piliers = empilement voulu).
- Captures : `captures/idle.png`, `jeu.png`, `fin.png`, `mobile.png`.

### En attente

- Choix de Gaia sur la direction visuelle (le jeu tourne ; l'habillage reste
  à trancher) : `/delta` pour ajuster, `/lock` pour figer.
- Décision d'hébergement (Q-012 : la démo hébergée est un plus, à garder
  jusqu'au 18–25/11).


### Claude · V11–V12 (ajout, le texte ci-dessus appartient à une autre session)

- **V11** : 02 · L'Objet verrouillée + icônes 3D des 6 parties + portrait de Léa (vérifiée 18/18, 0 erreur JS).
- **V12** : 10 planches WebGL2 « beaucoup plus 3D » `planches/v9/11` → `20`, sommaire `planches/v9/index.html`, toutes vérifiées 18/18 · 0 erreur JS. Détail dans DESIGN.md § V12.
- **Attention numérotation** : « V10 » désigne à la fois la planche 04-sceau (Claude) et le jeu `planches/v10/` (autre session).
- **Prochaine action** : Gaia choisit dans les 10 (ou garde 02) → `/lock` puis `/delta`.
- **V17 (2026-11-12)** : 🔒 37 · Galerie choisie par Gaia ; V16 rejetée (trop lourde), V17 = version affinée (violet fin, lisibilité). `planches/v9/37-cylindre.html`, vérifiée 18/18 · 0 erreur JS. Prochaine action : Gaia relit la V17 → /delta.
- **V18 (2026-11-12)** : `/planches 10` « 3D moderne, repars de zéro » → planches 41 → 50 (`planches/v9/41-fluide.html` … `50-kinetic.html`), toutes vérifiées 18/18 · 0 erreur JS. Recommandation Claude : 49 Isométrie, 44 Argile, 47 Lumière. Prochaine action : Gaia choisit (Garder / Changer / Essayer).
- **V19 (2026-11-12)** : `/variantes` de la 49 · Isométrie → 51 → 58 (immersion 51-54, grosses variantes modernes 55-58), plateau agrandi, socle `src/three/iso-base.mjs`. Toutes vérifiées 18/18 · 0 erreur JS. Recommandation Claude : 56 Grille ou 58 Plan. Prochaine action : Gaia choisit → /delta.
- **V20 (2026-11-12)** : 58 · Plan retenue ; 10 terminaux 61 → 70 (même scène, console différente), tous vérifiés 18/18 · 0 erreur JS. Recommandation Claude : 62 Cartouche ou 69 Fenêtre. Prochaine action : Gaia choisit le terminal → /lock 58 + terminal.
- **~~LOCK 65~~ (remplacé)** : `planches/v9/65-regle.html` (scène 58 Plan + terminal Règle). Prochaine action : opencode reporte ce design sur la page publique (via HANDOFF.md), Claude reste dispo pour /delta.
- **V21 (2026-11-12)** : `/planches` modernisation de la 65 → 71 → 80, toutes vérifiées 18/18 · 0 erreur JS ; 65 verrouillée inchangée. Recommandation Claude : 78 Signal (+ 71 Typo XXL). Prochaine action : Gaia choisit → /delta ou /lock.
- **V14 (2026-11-12) — re-brief Gaia, repartir de zéro** : `G-DESIGN/BRIEF-V14.md` (site avant-gardiste et non jeu, tout en 3D, fonds et contenus très soignés, logo + nom + slogan clair, 6 parties toujours visibles, une phrase par étape). 10 pistes 31 → 40 listées, pas encore construites (limite d'usage atteinte, reprise après 15 h 50).
- **V13 (Three.js, planches 21–30)** : 21, 25–30 livrées et vérifiées ; 22–24 interrompues (limite d'usage), non vérifiées.
- **V13 (historique)** : installés dans `planches/v9/src/three/` → three@0.170.0, esbuild@0.24.0 (binaire win32 présent, postinstall bloqué par npm : à valider avec `npx esbuild --version`). Écrits : `three/tpl3d.html` (gabarit HUD), `three/kit.js` (scène + bloom + caméra à plans + étiquettes + personnages Léa/agent/client + faisceaux + pièces). Reste : `build3.mjs` (esbuild IIFE → gabarit), planche 21 de référence, puis 22–30. Rien de testé.

- **V22 (2026-11-12)** : 42 · Pile de cartes retenue par Gaia → passe « améliore, modernise » (netteté ×2, verre irisé discret, permis plus présent, fond à lueurs douces). `planches/v9/42-cartes.html`, vérifiée 18/18 · 0 erreur JS. Prochaine action : Gaia relit → /delta ou /lock.
- **🔒 LOCK FINAL (2026-11-12)** : design retenu = `planches/v9/42-cartes.html` (V22), remplace la 65. Passation opencode écrite dans `HANDOFF.md`. Prochaine action : opencode reporte la 42 sur la page publique ; Claude reste dispo pour /delta.
- **Livraison Baptiste (2026-11-12)** : Gaia confie le report de la 42 à Baptiste → `G-DESIGN/livraison-baptiste/` + `demerit-design-42-pour-Baptiste.zip` (planche, sources, captures, README). Reconstruction vérifiée 18/18 · 0 erreur JS. Prochaine action : Gaia envoie le zip à Baptiste.
- **V23 (2026-11-13)** : « génère-en de tout nouveaux » → 6 planches inédites 81 → 86 (Dominos, Mouvement horloger, Circuit de billes, Jetons, Gonflable, Mobile), brief `BRIEF-V23.md`. Le lock 42 reste en place. Recommandation Claude : 82 Mouvement ou 85 Gonflable. Prochaine action : Gaia choisit (Garder / Changer / Essayer) → /delta ou /lock.
- **Vidéo de démo (2026-11-13)** : `G-DESIGN/video-demo/renders/demerit-demo.mp4` — 85 s, 1920×1080, 30 i/s, muet. Planche 42 réelle filmée image par image + accroche, problème, marque, preuve NEAR, carte de fin (« De quel métier voudriez-vous voir le permis ? »). Check HyperFrames : 0 erreur. Projet éditable : `G-DESIGN/video-demo/` (SPEC.md, STORYLINES.md). Prochaine action : Gaia valide, ajoute une musique si souhaité, publie sur X.
- **Vidéos de démo V1 (2026-11-13)** : parcours A→Z (règles du hackathon lues) — `video/demerit-demo-baptiste.mp4` (1:03, voix Baptiste, sans intro) et `video/demerit-demo-gaia.mp4` (2:18.6, voix Gaia, 5 explications NEAR). Voix ElevenLabs via with-secrets. Contrôles : silences, LUFS, planche contact. La vidéo HyperFrames du 12/11 est remplacée. Prochaine action : Gaia choisit, poste sur X.
- **V24 (2026-11-13)** : option A choisie — site web en anglais pour la vidéo, `G-DESIGN/app/` (vraie logique du contrat, journal on-chain séparé, lecture live testnet). Parcours complet vérifié au clic. Prochaine action : Gaia valide le design → refaire les 2 vidéos dessus.
- **Deadline design** : 14/11 — soumission 15/11 00:59 Paris
- **Horodatage** : 2026-11-11

### V10b — mode LIVE câblé sur la même page (2026-11-11)

- **Même page, deux modes** : `BAC À SABLE` (moteur local) ↔ `TESTNET LIVE`
  (JSON-RPC). Bascule dans la barre haute, config persistée en localStorage,
  surchargeable par query (`?contract=…&missions=…&rpc=…&pro=…`).
- **Lectures réelles** : `status`, `fund`, `credit`, `platform`, `missions`,
  `escrowed`, `nft_token`, `clock`, `issuer`, `delegation`.
- **Écritures réelles sans clé** : chaque action produit une **intention** —
  commande `near-cli-rs` à coller **+ lien de signature MyNearWallet**
  (transaction Borsh non signée, nonce et block_hash lus en JSON-RPC).
  Réutilise `web/actions.js` **copié à l'identique** (hash vérifié).
- **Sonde de déploiement** : `RpcSource.probe()` distingue compte inexistant /
  compte sans contrat / contrat déployé, et affiche l'état réel.

#### BLOCAGE — à traiter côté Baptiste (owner B)

Vérifié contre `https://rpc.testnet.near.org` le 2026-11-11 :

| Compte | État |
|---|---|
| `demerit.testnet` | existe · solde 0,3150519 Ⓝ · **`CodeDoesNotExist`** (aucun contrat) |
| `missions.demerit.testnet` | **n'existe pas** |
| `web/config.js` | `contract: ''`, `missions: ''` (vides) |
| `out/testnet.json` | absent |

**Rien n'est déployé → le mode LIVE ne peut pas encore fonctionner.** Il faut
`make testnet` (faucet, sous-comptes, déploiement des 2 contrats, scénario
amorcé), puis reporter les adresses dans `web/config.js`. Ensuite cette page
fonctionne en réel **sans modification de code** : il suffit de remplir le
panneau de configuration.

#### Vérifications

- **Bac à sable** (headless, `?auto=1`) : 15/15 objectifs · **7/7 attaques
  refusées** · invariant I2 exact (1,65 = 1,65) · état final pts 6 · caution
  1,25 = exigée 1,25 · coef 125 · fonds 0,20 · 71 polygones · **0 NaN** ·
  **0 erreur JS**.
- **Live** (headless, vrai RPC testnet) : `probe.ok=false` ·
  `error="aucun contrat déployé sur demerit.testnet"` ·
  `registry.exists=true deployed=false balance=0.3150519` ·
  `platform.exists=false` · snapshot vide propre · **0 erreur JS**.
- `node --check` sur les 7 scripts : OK.
- Captures : `captures/01-sandbox-idle.png` · `02-sandbox-jeu.png` ·
  `03-sandbox-fin.png` · `04-live-nondeploy.png`.

#### Fichiers ajoutés

`actions.js` (copie de `web/actions.js`) · `sources.js` étendu (RpcSource +
table LIVE des 34 appels) · `live.js` (config + bascule de mode) ·
panneaux `#livecfg` et `#livepanel` + CSS.
### V10c — tentative de déploiement réel (2026-11-11)

Gaia : « fais-le toi-même ». État des lieux vérifié sur cette machine.

#### Ce qui a fonctionné

- **Les deux contrats compilent en wasm** (`cargo build --target
  wasm32-unknown-unknown --release -p demerit -p missions`, `RUSTFLAGS=--cfg near`) :
  `demerit.wasm` **320 KB**, `missions.wasm` **180 KB**, build en 6 min 50 s.
  → `make build` est vert.
- **Le portage JS est conforme au contrat** : `planches/v10/verify-rules.mjs`
  rejoue les assertions du `#[cfg(test)]` de `rules.rs` **et** les 7 attaques
  de `make attack` → **RULES OK (23/23)** :
  permis neuf 6/6 probation · moyen −3 · +6 mois → 4 · grave → 0 + suspendu +
  invalidations 1 · plafond 8/10/12 à 12/24/36 mois · régénération totale à
  24 mois · coef ×1,25 et caution exigée 1,25 Ⓝ · invariant I2 tenu sur
  11 étapes · ERR_NOT_PLATFORM · ERR_MISSION_ALREADY_RECORDED ·
  ERR_IDENTITY_ALREADY_LICENSED · ERR_SOULBOUND · ERR_NOTHING_TO_WITHDRAW ·
  ERR_DELEGATION_EXPIRED · ERR_PLATFORM_SUSPENDED.

#### Ce qui bloque (outillage + secrets, pas le code)

| Manque | Conséquence |
|---|---|
| `near-cli` absent | pas de déploiement via la voie documentée |
| `make` absent | les cibles du Makefile ne tournent pas (cargo direct OK) |
| `bash` absent | `scripts/testnet.sh` inexploitable sous Windows |
| `cmake` et `NASM` absents | `aws-lc-sys` (via `near-workspaces`) ne compile pas → **`make test`, `make demo`, `make attack`, `make sim` impossibles ici** |
| **aucune clé NEAR testnet** | `~/.near-credentials` absent, `out/` absent, et **aucun secret NEAR dans Bitwarden** (23 secrets listés, noms uniquement, aucun NEAR) |

**Conclusion : je ne peux pas déployer.** Il manque un compte testnet financé
avec sa clé privée. Je ne dois ni en inventer ni en fabriquer :
`AGENTS.md` interdit tout secret en dur, affiché ou commité.

#### Ce qu'il faut pour débloquer (une seule personne, ~10 min)

1. Sur une machine avec `near-cli`, `make`, `bash` (+ `cmake` ou `NASM` pour
   les tests) : `make testnet` — crée le compte faucet, les sous-comptes,
   déploie les 2 contrats, amorce le scénario.
2. Récupérer les adresses dans `out/testnet.json` et les reporter dans
   `web/config.js` (`contract`, `missions`).
3. Ouvrir `planches/v10/index.html`, basculer sur **TESTNET LIVE**, coller les
   deux adresses → la page lit la chaîne et produit les liens de signature.
   **Aucune modification de code nécessaire.**

Alternative sans outillage : déployer depuis n'importe quel poste Linux/WSL
avec `cargo near build` + `near contract deploy`, puis ne renseigner que les
adresses dans le panneau LIVE.

#### Ajout

`planches/v10/verify-rules.mjs` — vérification autonome du portage JS contre
les vecteurs Rust, sans toolchain Rust. À lancer : `node verify-rules.mjs`.

## opencode

### V14 — socle neuf + planche 31 (2026-11-12)

- **Reprise de zéro** demandée par Gaia : `planches/v14/`, tout est neuf (shell,
  design system, kit Three.js, mode manuel). Aucun code des v2→v13 réutilisé,
  sauf `src/moteur.js` (copie octet-à-octet de `v10/moteur.js`, portage 1:1 de
  rules.rs, vérifié 23/23 contre les vecteurs Rust).
- **Consignes Gaia (2026-11-12)** : 3D partout, moderne dans les moindres
  détails, fonds très polishs, apparence de site avant-gardiste (pas d'un jeu),
  toutes les parties visibles, slogan percutant explicite + logo + nom de
  marque, scénario compréhensible dès qu'on appuie sur « lancer ».
- **Socle `v14/src/`** : `tpl.html` + `style.css` (logo SVG animé, marque
  demerit, slogan révélé par lignes, rail des 6 parties, rail des 11 étapes,
  colonne de chiffres, légende des 6 natures d'interaction, panneaux
  translucides terminal | benchmarks, annexe complète), `core.js` (scénario
  certifié 18 temps inchangé + chrome + rapport headless), `kit3d.js`
  (environnement procédural pour les reflets, backdrop shader, bloom,
  grain/vignette/aberration, DOF optionnelle, caméra à plans, faisceaux par
  nature d'interaction), `assets.js` + `type3d.js` (personnages, carte-permis
  texturée, empreinte, coffre, typo 3D), `manuel.js` (mode jouable),
  `build.mjs` (esbuild IIFE, zéro CDN), `verify.mjs` (headless Chrome :
  scénario + manuel), `revue.mjs` (galerie de captures légendées).
- **Planches 31 → 40** (en cours) : `31-ecluse.html` écrite et vérifiée ;
  32→40 à venir, une fois la direction visuelle validée.
- **Retours Gaia intégrés (2026-11-12)** :
  1. *Murs transparents* : matériau `wall` (verre + clearcoat, sans
     transmission pour rester léger) → on voit l'eau, la péniche et les vannes.
  2. *Console sous la 3D* : une ligne de blocs translucides à angles arrondis —
     terminal à gauche (bloc PROGRAMME avant lancement), benchmarks à droite
     (10 cibles `make`, durée + résultat).
  3. *Utiliser vraiment la techno* : mode **MANUEL** dans la barre haute —
     5 rôles + TEMPS, ~30 vrais appels du moteur, 15 objectifs, les 7 attaques
     de `make attack` cliquables, vrais codes de refus, invariant I2 affiché
     après chaque appel, et la 3D suit l'état (`SCENE.manual`).
- **Vérifications (exécutées en Chrome headless, 2026-11-12)** :
  - scénario : `18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0 | chrome 3L/6P/11C/6K/11E`
  - manuel : `30/30 appels | objectifs 15/15 | attaques refusées 7/7 | I2 ok | pts 6 · caution 1,25 · client 0,20 · fonds 0,20`
  - captures : `v14/captures/` (16 PNG 1600×900) + galerie `v14/revue.html`.
- **En attente** : validation visuelle Gaia sur `v14/revue.html`, puis
  écriture des 9 planches 32→40 (par lots, même socle, même vérification).
- **LIVE testnet** : non câblé dans v14 — `demerit.testnet` n'a toujours aucun
  contrat déployé (cf. V10c) ; le mode manuel couvre « utiliser la techno »
  avec le vrai moteur. À brancher (`v10/sources.js` + `live.js` + `actions.js`)
  quand `make testnet` aura été fait.
- **Horodatage** : 2026-11-12 · opencode

### V14b — mode LIVE testnet câblé (2026-11-12)

- Les contrats **sont maintenant déployés** (rebase sur `origin/main` : commits
  `0de6dae`, `d160c00`, `7ade266`, `352e8e1`) : registre `ledger.demerit.testnet`,
  plateforme `platform.demerit.testnet`, RPC public FastNEAR. La note V14
  « LIVE non câblé » est caduque.
- **Mode LIVE ajouté** à v14 (3e bouton de la barre haute) : lectures réelles
  par JSON-RPC (vues gratuites, sans clé) — `status`, `fund`, `credit`,
  `nft_token`, `clock` — et pour chaque action une **intention signable** :
  commande `near-cli-rs` prête à coller + lien MyNearWallet, via `actions.js`
  (copie octet-à-octet de `web/actions.js`). La page ne détient aucune clé.
- Comptes live utilisés : `lea.demerit.testnet`, `client.demerit.testnet`,
  `issuer.demerit.testnet`, `platform.demerit.testnet`.
- **Vérification LIVE** : `ledger.demerit.testnet | état 12 pts · active ·
  caution 0,17 / 0,13 · coef 1,25 | fonds 0,02 · client 0,04 | jeton demerit-1`.
- Trois modes vérifiés headless sur `31-ecluse.html` : scénario `18/18`,
  manuel `30/30 appels · 15/15 objectifs · 7/7 attaques`, live OK. 0 erreur JS.
- **Horodatage** : 2026-11-12 · opencode

### V14c — passation vers Claude (2026-11-12)

- Gaia passe le design à un chat Claude (meilleur design demandé). opencode
  rédige la passation complète : `G-DESIGN/HANDOFF-CLAUDE.md` — état des lieux
  vérifié, exigences cumulées, checklist « à faire avant la soumission »
  (10 planches, vidéo + post X à confirmer avec Gaia, repo propre, push 403 à
  débloquer côté Baptiste), fichiers à lire, prompt relais prêt à coller.
- Le socle v14 reste disponible et vérifié (3 modes headless au vert sur
  `31-ecluse.html`) ; Claude peut le réutiliser ou le remplacer.
- **Horodatage** : 2026-11-12 · opencode

- **Vidéo V2 (Claude)** : une seule vidéo `video/demerit-demo.mp4`, 2:17, voix Baptiste, anglais, site A V25, 5 explications NEAR, check live testnet, carte de fin avec liens + question. Contrôles OK. Phase : livraison vidéo · round V2 · 2026-11-13 · Claude

- **Livraison PR Baptiste (Claude)** : `livraison-pr-baptiste/` + `demerit-PR-pour-Baptiste.zip` (45 fichiers G-DESIGN, script publier.ps1 testé en DryRun, PR.md). Push Claude refusé (403) → Baptiste commit/PR/merge. 2026-11-13 · Claude

- **V26 (Claude)** : 5 planches `planches/v26/91-95` (Blueprint, Glass, Humanist, Pitwall, Yard OS) d apres iterate/hackodds/1x/msai/lando/terminal-industries. Reco 93. Non commite (commit = Baptiste). Phase : planches · round V26 · 2026-11-13 · Claude
