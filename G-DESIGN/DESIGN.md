# DESIGN.md — demerit (NEAR, NFTs That Do Something)

Direction artistique de la page publique `web/` (une seule page statique,
9 sections : consultation, contrôle, NFT, mon permis, missions, émetteur,
barème, fonds, scénario). Brief : `G-DESIGN/BRIEF-UI.md`.
Repo code : lecture seule (Baptiste).

Ton imposé : **institutionnel crédible mais moderne** (confiance + web3).
Juges : implémentation, design, impact, originalité. Le NFT **est** le produit :
un permis professionnel non transférable, à points, adossé à une caution.

Contraintes de mise en œuvre (lues dans le repo) :

- Page **zéro dépendance, zéro CDN** (footer) → pas de Google Fonts : piles
  système ou woff2 auto-hébergés dans `web/fonts/`.
- Tout passe par les tokens CSS existants (`--bg --card --ink --muted --line
  --accent --ok --warn --low --radius`) : une planche = un jeu de tokens +
  les composants (jauge, badge, carte NFT, table, bloc action).
- Données denses (14 champs de statut, tableaux) : la lisibilité n'est pas
  négociable, c'est ce que le jury voit en premier.

---

## V1 — 2026-11-11 · `/planches 6` : six directions contrastées

### Planche 1 — « Passeport » (document d'État)

**Concept** : le produit s'appelle *permis*. On assume le document officiel :
fond papier ivoire, filets de sécurité, typographie d'imprimé administratif,
tampons de statut, numéro de jeton gravé. Le web3 est dans les données, pas
dans les effets. Crédibilité maximale, aucune ressemblance avec un dashboard.

- **Palette** : papier `#F6F1E6`, encre `#15202B`, filet `#D9CFBB`, accent
  bleu officiel `#1B3A6B`, tampon carmin `#9E2B25`, or `#B08A3E`,
  valide `#2E6B4F`, probation `#8A5A12`, suspendu `#8E2323`.
- **Typo** : titres serif (Source Serif / Georgia), corps en serif de lecture,
  chiffres et codes en mono (`ui-monospace`, SFMono, Consolas). Petites
  capitales pour les libellés de champs.
- **Grille** : une colonne de lecture centrée (max 960 px), cartes à filet
  1 px, coins 4 px, ombre quasi nulle ; chaque section numérotée comme les
  articles d'un règlement.
- **Signature** : le permis rendu comme une **carte d'identité professionnelle**
  (bandeau émetteur, photo/empreinte remplacée par l'empreinte hachée, jauge
  de points en 12 cases pleines/vides, QR vers la page) ; les signalements
  comme un **casier** imprimé ; les refus comme des **tampons** « REFUSÉ —
  ERR_LICENSE_SUSPENDED ».
- **Message juges** : sérieux d'institution + originalité forte ; le design
  explique le concept sans un mot de marketing.
- **Risque** : peut paraître « vieux » sur un écran ; il faut un contrepoint
  numérique net (mono, jauge, QR) pour ne pas tomber dans le pastiche.

### Planche 2 — « Registre suisse » (institutionnel numérique)

**Concept** : le portail d'administration publique moderne : blanc, grille
stricte, un seul rouge signal, zéro décoration. La confiance par la sobriété.
C'est la planche la plus « implémentable en une heure » et la plus accessible.

- **Palette** : fond `#FFFFFF`, surface `#F4F4F4`, encre `#111111`, gris
  `#5F6368`, filet `#DDDDDD`, rouge officiel `#D8232A`, valide `#0B7A3B`,
  probation `#B26A00`, suspendu `#B00020`.
- **Typo** : grotesque suisse (Helvetica Neue / Arial / system-ui), chiffres
  tabulaires, libellés 12 px en capitales espacées, aucune graisse fantaisie.
- **Grille** : 12 colonnes, gouttière 24 px, sections pleine largeur avec
  filet supérieur épais ; formulaires en ligne, tableaux sans zebra.
- **Signature** : le permis comme une **fiche d'état civil** (deux colonnes
  libellé/valeur, jauge fine de 6 px, pastille de statut) ; la vérification
  comme un **guichet** : une question, une réponse OUI/NON en 48 px, un code
  de refus en mono.
- **Message juges** : crédibilité institutionnelle immédiate, accessibilité
  (contraste AA facile), lisibilité parfaite des données.
- **Risque** : originalité faible — un jury qui voit 100 projets web3 ne le
  retiendra pas ; il faudra que la vidéo porte le « wow ».

### Planche 3 — « Pupitre de contrôle » (terminal sombre)

**Concept** : le permis est un instrument de mesure. Interface de salle de
contrôle : fond nuit, jauges, seuils, alarmes, monospace partout, chiffres
alignés. Le point de départ du repo (bleu `#1f4e79` sur gris clair) poussé
dans sa version la plus crédible : l'instrumentation.

- **Palette** : fond `#0C1117`, panneau `#131A22`, texte `#DCE5EE`, filet
  `#243040`, accent cyan `#2FA8C9`, vert valide `#3DDC84`, ambre probation
  `#F5A623`, rouge suspension `#FF5A5F`, or caution `#C9A227`.
- **Typo** : mono pour toute l'UI et les chiffres (JetBrains Mono / Cascadia
  / Consolas), titres en mono capitales espacées ; aucune serif.
- **Grille** : panneaux à filet 1 px, coins 2 px, densité élevée, en-tête
  collant avec statut global + horloge on-chain.
- **Signature** : la jauge de points comme un **manomètre segmenté** (12
  segments, seuils 0/3/6/12 marqués), la caution comme un **compteur** avec
  delta, la console émetteur comme un **pupitre d'agrément** (plateformes,
  strikes 1/3, 2/3, 3/3), les refus comme des **lignes d'alarme** avec code.
- **Message juges** : ingénierie, déterminisme, « ce truc tourne vraiment ».
  Colle au critère implémentation.
- **Risque** : cliché du dashboard sombre web3 ; moins « institutionnel »
  que demandé au brief ; lisibilité des longs tableaux en sombre à surveiller.

### Planche 4 — « Permis vivant » (NEAR natif, web3 lumineux)

**Concept** : on vend d'abord le NFT. Fond noir NEAR, vert NEAR, dégradés
maillés discrets, carte du permis en héro avec inclinaison 3D légère, badge
« soulbound » visible, wallet-first. Le côté « ça vit » : points, coefficient
et statut changent à la lecture, sans transaction.

- **Palette** : fond `#000000`, surface `#0B0F0C`, texte `#F2F5F3`, vert NEAR
  `#00EC97`, vert profond `#00B37A`, gris `#8A9691`, ambre `#FFC24B`,
  rouge `#FF6B6B`, dégradé héro `#00EC97 → #6EE7F9`.
- **Typo** : grotesque géométrique (Space Grotesk / system-ui), mono pour les
  comptes NEAR et les codes d'erreur.
- **Grille** : héro pleine largeur + cartes flottantes, sections alternées,
  rayons 16 px, glow léger sur la carte NFT uniquement.
- **Signature** : carte NFT **hero** avec titre dynamique (« Coursier · 9/12 ·
  valide »), galerie de credentials en grille de cartes, vérification en
  **scan QR** animé, délivrance en **stepper** 3 étapes.
- **Message juges** : « c'est un vrai NFT NEAR, regardez le wallet » ;
  reconnaissance immédiate de l'écosystème.
- **Risque** : c'est ce que feront 80 % des participants ; l'institutionnel
  crédible du brief passe au second plan ; le noir + néon date vite.

### Planche 5 — « Édition civique » (journal, storytelling)

**Concept** : traiter le registre comme un sujet de presse économique :
une de journal, gros titres serif, colonnes, chiffres en display, filets
noirs, encadrés « ce que ça change ». Les 9 étapes du scénario deviennent
un **reportage** (« Léa perd son permis à 14 h 02, le récupère à 14 h 03 »).

- **Palette** : crème `#F3EFE7`, encre `#141414`, filet `#1F1F1F`, rouge
  signal `#B3261E`, vert `#0E6B4F`, ambre `#A96A00`, papier article `#FBF8F2`.
- **Typo** : display serif condensé (Playfair / Georgia bold) pour les titres,
  serif de lecture pour le corps, mono pour codes et hashs.
- **Grille** : 2 à 3 colonnes façon quotidien, lettrines, chapôs, filets
  épais entre sections ; les tableaux deviennent des « tableaux de la
  rédaction » avec titres parlants.
- **Signature** : la consultation ouvre sur un **chapô** qui résume le permis
  en une phrase, puis la fiche ; le casier en **brèves** ; la délivrance en
  **encadré procédure** ; le fonds de garantie en **encadré chiffres clés**.
- **Message juges** : originalité éditoriale, impact narratif, mémorabilité.
- **Risque** : moins « outil » ; les 9 sections doivent rester utilisables
  (les formulaires et les tables denses jurent avec le journal) ; à réserver
  au héro + scénario, pas aux consoles.

### Planche 6 — « Carte à puce » (artifact-first)

**Concept** : une seule idée, tenue partout : la **carte de permis** est
l'interface. Elle est persistante (bandeau ou rail latéral), change de face
selon l'écran (recto identité, verso barème, tranche caution) et porte le QR.
Fond neutre sombre pour faire ressortir l'hologramme de la carte.

- **Palette** : fond `#101317`, surface `#171C22`, texte `#E8EDF2`, carte
  dégradé `#0F766E → #4338CA` (hologramme teal→violet), or `#D4AF37`, vert
  valide `#34D399`, ambre `#FBBF24`, rouge `#F87171`, gris `#94A3B8`.
- **Typo** : IBM Plex Sans (UI) + IBM Plex Mono (numéros, empreinte, codes),
  titres en 600 serrés ; cohérent avec l'esthétique « carte à puce ».
- **Grille** : rail de carte 320 px + zone de contenu fluide (desktop),
  carte en pleine largeur en mobile ; rayons 12 px, ombre portée unique.
- **Signature** : recto = identité + jauge 12 points + statut + QR ; verso =
  barème et casier ; tranche = caution versée/exigée/coefficient ; la
  vérification est un **lecteur de carte** (le tiers « insère » le compte et
  lit le verdict) ; la délivrance est une **personnalisation de carte**.
- **Message juges** : le NFT comme objet tangible, produit évident en 3 s ;
  originalité par le système, pas par la déco.
- **Risque** : gadget si la carte ne sert qu'au héro ; encombrement sur
  mobile ; il faut accepter que les tableaux restent des tableaux.

---

## Tableau de décision

| # | Direction | Confiance institutionnelle | Lisibilité NFT/web3 | Originalité | Lisibilité data | Risque principal |
|---|---|---|---|---|---|---|
| 1 | Passeport | ●●●● | ●●●○ | ●●●● | ●●●○ | paraître daté |
| 2 | Registre suisse | ●●●● | ●○○○ | ●○○○ | ●●●● | générique |
| 3 | Pupitre de contrôle | ●●●○ | ●●○○ | ●●○○ | ●●●○ | cliché dashboard |
| 4 | Permis vivant | ●●○○ | ●●●● | ●●○○ | ●●○○ | cliché web3 |
| 5 | Édition civique | ●●●○ | ●●○○ | ●●●● | ●●○○ | outil vs journal |
| 6 | Carte à puce | ●●●○ | ●●●● | ●●●● | ●●●○ | gadget / mobile |

**Recommandation** : **Planche 1 « Passeport » comme identité principale** —
c'est la seule qui fait du concept (un permis officiel, non transférable,
à points) le design lui-même, avec la crédibilité que demande le brief et
une originalité que personne d'autre n'aura sur ce track. On lui emprunte
deux briques : la **jauge instrumentée** de la planche 3 (12 segments, seuils
0/3/6/12, delta de caution) et le **traitement carte + QR** de la planche 6
pour l'écran NFT. Chaque planche reste verrouillable seule (`/lock`).

**Prochaine action suggérée** : `/compare 1 6` (document officiel vs objet
NFT — c'est l'arbitrage qui décide de tout), puis `/cible passeport` pour
dessiner en détail la carte de permis avant de décliner les 8 autres sections.

### Changelog V1

- Création : 6 directions contrastées, contraintes de mise en œuvre tirées du
  repo (zéro CDN, tokens CSS existants, 9 sections), tableau de décision,
  recommandation hybride 1 + 3 + 6.

---

## V1b — 2026-11-11 · les 6 planches en HTML complet

Les six directions sont désormais **exécutables**, pas seulement décrites.
Fichiers dans `G-DESIGN/planches/`, un HTML autonome par planche
(CSS inline, zéro CDN, zéro dépendance, responsive).

| Fichier | Direction | Signature visuelle |
|---|---|---|
| `planche-1-passeport.html` | Passeport | carte d’identité pro, filets de sécurité, tampon, jauge 12 cases, casier imprimé |
| `planche-2-registre-suisse.html` | Registre suisse | blanc, grille 1 px, capitales espacées, un seul rouge |
| `planche-3-pupitre.html` | Pupitre de contrôle | mono, panneaux à coins cyan, segments 0/3/6/12, alarmes |
| `planche-4-permis-vivant.html` | Permis vivant | noir + vert NEAR, carte NFT héro, cadran conique, QR |
| `planche-5-edition-civique.html` | Édition civique | une de journal, lettrine, colonnes, brèves, encadrés |
| `planche-6-carte-a-puce.html` | Carte à puce | carte persistante en rail, recto/verso/tranche, lecteur de carte |
| `index.html` | sommaire | vignettes live (iframes) + tableau de couverture fonctionnelle |

**Couverture fonctionnelle identique sur les 6 planches** (rien d’inventé,
tout vient du code lu) :

1. **Permis NFT** — titre calculé à la lecture (« Coursier · 9/12 · valide »),
   jauge 12 points, statut (probatoire/actif/suspendu/révoqué/rendu), identité
   = empreinte salée, caution versée/exigée, coefficient, refus de transfert.
2. **Vérification** — `check()` avec les 5 exigences réelles (`min_points`,
   `min_missions`, `max_invalidations`, `min_age_months`, `max_coefficient`),
   verdict OUI/NON **et code de refus** (`ERR_LICENSE_SUSPENDED`,
   `ERR_UNDER_BONDED`, `ERR_POINTS_TOO_LOW`, …), avec l’ordre d’évaluation.
3. **Casier** — anneau des 20 derniers signalements : mission, classe
   (propre/léger/moyen/grave), date, état (appliqué/contesté/confirmé/annulé),
   points perdus, montant prélevé, preuve hachée.
4. **Argent** — caution versée / exigée / excédent retirable, coefficient
   0,50–3,50, indemnité client sur faute grave, fonds de garantie (20 %).
5. **Flotte** — délégations actives / expirées / révoquées, compteur de
   signalements par délégué, suspension du titulaire qui arrête tout.
6. **Missions** — ouverte / prise / close, récompense sous séquestre, issue,
   effet exact sur les points et la série.
7. **Émetteur** — catégories versionnées, agrément plateforme, strikes 1/3,
   recours, révocation.
8. **Barème** — 12 max, 6 probation, +2/an, −1/−3/−6, +1 après 6 mois, plafond
   plein à 24 mois, stage +4, suspension 6 mois, 3 strikes.
9. **Fonds & invariant I2** — équation de conservation complète.
10. **Scénario** — les 9 étapes certifiées `make demo` avec leurs refus.
11. **Refus & événements** — codes normalisés assertables + journal NEP-297.

**Écarts assumés** : les polices sont des piles système (aucun CDN autorisé
par le footer de la page) ; les noms de police cités (Playfair, IBM Plex,
Space Grotesk) servent de référence si un woff2 auto-hébergé est ajouté plus
tard dans `web/fonts/`.

**Prochaine action suggérée** : `/compare 1 6`, puis `/cible passeport`
(l’écran permis en détail) avant `/lock`.

### Changelog V1b

- 6 planches HTML autonomes + `index.html` (vignettes live + couverture).
- Contenu fonctionnel vérifié contre `contracts/demerit/src/*` et
  `contracts/missions/src/lib.rs` : aucun chiffre, code ou règle inventé.
- Captures headless produites (Chrome, 1280 px) pour contrôle visuel.

---

## V2 — 2026-11-11 · six identités jouables (`planches/v2/`)

Retour de Gaia : les planches V1 étaient **trop descriptives**, pas assez
identitaires, et ne montraient pas le produit en mouvement. V2 reconstruit
le pack autour d'une exigence unique : **regarder la planche, comprendre le
produit, appuyer sur un bouton et voir tout le processus se dérouler.**

### Règles de design V2

| Contrainte | Application |
|---|---|
| Fond sombre | toutes les 6 planches sur noir / quasi-noir |
| Max 2 couleurs | 1 fond + 1 accent (l'encre neutre ne compte pas) |
| Avant-gardiste | 6 langages visuels distincts, pas 6 déclinaisons |
| Peu de texte | titres courts, chiffres en grand, explications en 1 ligne |
| Tout visible | aucune fonctionnalité retirée, tout est animé |
| Processus jouable | bouton « lancer le scénario » = les 9 étapes de `make demo` |
| Benchmarks | 7 lignes `make *` avec durées réelles du README |

### Les six identités

| # | Fichier | Accent | Signature | Porte |
|---|---|---|---|---|
| 01 | `01-signal.html` | volt `#D8FF3E` | grille technique, angles découpés, jauge en barres hautes | deux barres qui coulissent |
| 02 | `02-terminal.html` | ambre `#FFB000` | mono intégral, scanlines, curseur clignotant, bordures plates | parenthèses ASCII qui s'écartent |
| 03 | `03-orbite.html` | cyan `#22D3EE` | le permis est un **cadran** : 12 graduations radiales | anneaux qui tournent et s'ouvrent |
| 04 | `04-grille.html` | magenta `#FF2E93` | modules à filets, sections numérotées 01→04, cellules denses | deux blocs qui coulissent |
| 05 | `05-lame.html` | blanc `#FFFFFF` | typo-pographie pure, filets d'1 px, chiffres extremely légers | deux filets qui se fendent |
| 06 | `06-fusion.html` | indigo `#4D5DFF` | dégradé, halo, fil qui traverse, particules qui voyagent | deux battants qui s'ouvrent en 3D |

### Le socle commun (identique dans les 6)

1. **Permis** — titre calculé, jauge 12 points, statut, empreinte, caution
   versée/exigée, coefficient, invalidations, missions.
2. **La porte** — `is_allowed` / `check` : OUI ou NON **avec le code de
   refus** (`ERR_LICENSE_SUSPENDED`, `ERR_IDENTITY_SUSPENDED`,
   `ERR_UNDER_BONDED`, `ERR_SOULBOUND`).
3. **L'argent** — caution / fonds / crédit client, qui se mettent à jour en
   direct pendant le scénario.
4. **Le scénario jouable** — 9 étapes, chiffres exacts de `demo/src/main.rs` :
   6 pts → 3 pts → 4 pts (régénération) → 0 pt + suspension, caution
   1,00 → 0,60, fonds +0,20, client +0,20, coef 1,25, caution exigée 1,25,
   refus `ERR_UNDER_BONDED` puis `top_up_bond` +0,65 et acceptation.
   Fin : `DEMO OK (10/10)` + l'équation de l'invariant I2.
5. **La machine à temps** — curseur 0→24 mois qui recalcule la jauge
   (`rules::effective`) : prouve le calcul paresseux, sans transaction.
6. **Le casier hérité** — compte 2 / même empreinte → invalidation, coef
   1,25, suspension en cours.
7. **Les benchmarks** — `make build / test / demo / attack / sim /
   web-smoke / testnet`, durées issues du README.
8. **Les codes de refus** — 9 codes avec leur cause en clair.

### Vérifications faites

- JS extrait et contrôlé syntaxiquement (`node --check`) : OK sur les 6.
- 25 identifiants DOM référencés par le JS : présents dans les 6 fichiers.
- Rendu headless Chrome (1300 px) : 6 captures produites, aucune page vide.
- Zéro CDN, zéro dépendance, une seule police système.

### Changelog V2

- 6 planches V2 jouables + sommaire `v2/index.html`.
- Le bouton « Lancer le scénario » rejoue le scénario réel du dépôt.
- Benchmarks, machine à temps, casier hérité et codes de refus ajoutés.
- V1 conservé dans `planches/` pour comparaison ; `planches/index.html`
  renvoie vers V2.

---

## V3 — 2026-11-11 · `/variantes 10` sur la planche 06

Gaia tranche : **on part sur la 06 (Fusion)**. Demandé : plus d'animation,
plus de caractère, violet plus insistant, et un livrable qui montre tout le
processus. Livré dans `planches/v2/` (fichiers `01-mesh` … `10-spot`), tous
générés depuis un gabarit unique (`_tpl.html` + `_gen.ps1`) : le moteur de
scénario est identique, seul le langage visuel change.

### Le moteur de scénario enrichi (commun aux 10)

FX ajoutés au gabarit, absents de V2 :

| FX | Effet |
|---|---|
| `banner()` | titre plein écran cinématique (« PERMIS DÉLIVRÉ », « 0 POINT », « CASIER HÉRITÉ », « NON TRANSFÉRABLE ») |
| `flash()` | flash plein écran violet à la faute grave et au transfert |
| `shock()` | onde de choc concentrique à chaque refus |
| `burst()` | particules chiffrées qui s'envolent (« −3 », « +0,20 Ⓝ au client ») |
| `roll()` | compteur de chiffres animé (points, caution, fonds, crédit) |
| `casier()` | 3 cases du casier qui se remplissent au fil du scénario |
| `?auto=1` | l'URL lance le scénario seule (capture vidéo, jury pressé) |

Le scénario est désormais **lisible d'un coup d'œil** : à chaque instant on
voit le permis, l'état de la porte, l'argent et la ligne de log.

### Les dix identités

| # | Fichier | Nom | Violet | Traitement dominant |
|---|---|---|---|---|
| 01 | `01-mesh.html` | Mesh | `#8B5CF6` | halo confluent, glass, spin lent en arrière-plan |
| 02 | `02-neon.html` | Néon | `#C084FC` | tubes, scanlines, angles vifs, halo max |
| 03 | `03-liquid.html` | Liquide | `#A855F7` | blobs organiques qui dérivent, formes molles |
| 04 | `04-prism.html` | Prisme | `#8B5CF6` | facettes anguleuses, clip-path, pips en triangles |
| 05 | `05-plasma.html` | Plasma | `#A78BFA` | champs de plasma animés, pips ronds |
| 06 | `06-eclipse.html` | Éclipse | `#9D6BFF` | permis circulaire, couronne orbitale |
| 07 | `07-type.html` | Typo | `#B794F6` | typo cinétique géante,几乎没有 décor |
| 08 | `08-chroma.html` | Chroma | `#9F7AEA` | dégradé continu qui respire, reflets cyan |
| 09 | `09-filament.html` | Filament | `#7C3AED` | champ de particules dérivantes, pips en filaments |
| 10 | `10-spot.html` | Vitrine | `#7F5AF0` | mise en produit, halo de projecteur sur le permis |

### Vérifications faites

- `node --check` sur les 10 scripts : OK.
- 25 identifiants DOM référencés : présents dans les 10.
- **Scenario exécuté en headless Chrome** (`?auto=1`) sur les 10 : état final
  vérifié = pts 6, caution 1,25, fonds 0,20, crédit 0,20, inval 1,
  missions 1/1, `DEMO OK (10/10)` — identique sur les 10.
- 2 bugs corrigés en route : compteurs qui se marchaient dessus (jeton
  d'annulation), et animation `requestAnimationFrame` figée en headless
  (passée sur `setTimeout`).
- Captures headless produites pour les 10.

### Ce qu'un livrable NEAR doit afficher (cahier des charges)

Inscrit dans `planches/v2/variantes-index.html` : 1) ce que c'est en 3 s ·
2) la preuve NFT standard (token_id / owner / computed_title + NEP-171/181/393)
· 3) « do X → see Y » avec sortie réelle · 4) pourquoi NEAR · 5) la preuve
(18 tests, 7 attaques, 5 robots, I2) · 6) les limites assumées et la roadmap
MAX · 7) repo / vidéo / post X · 8) le disclaimer IA déjà dans le README.

### Changelog V3

- 10 variantes de la planche 06, jouables, violettes, zéro dépendance.
- Gabarit + générateur conservés (`_tpl.html`, `_gen.ps1`) : toute nouvelle
  variante se fait en ~15 lignes de CSS.
- `variantes-index.html` : vignettes live + cahier des charges livrable NEAR.
- `?auto=1` ajouté à toutes les planches (auto-lecture).

---

## V4 — 2026-11-11 · `/planches-variantes 6` — lot néon violet (`planches/v2/v3/`)

Retour de Gaia : « aucun n'est assez moderne, peut-être néon violet ». Réponse :
**socle neuf**, pas une recoloration. Le moteur reste identique (les 9 étapes
réelles de `make demo`), tout le langage visuel est reconstruit.

### Les six variantes

| # | Fichier | Nom | Violet | Traitement dominant |
|---|---|---|---|---|
| 01 | `01-neon.html` | Néon | `#A855F7` | tubes blancs, bloom SVG double, halo max |
| 02 | `02-aurora.html` | Aurora | `#7C5CFF` | maille de dégradés animée, verre dépoli (`backdrop-filter`) |
| 03 | `03-prisme.html` | Prisme | `#9F7AEA` | facettes `clip-path`, pips triangulaires, coins coupés |
| 04 | `04-orbite.html` | Orbite | `#8B5CF6` | permis circulaire, pips en billes, badges ronds |
| 05 | `05-mono.html` | Mono | `#9B7BFF` | 100 % monospace, trame technique, angles vifs |
| 06 | `06-eclat.html` | Éclat | `#7C3AED` | typo géante 132 px, spotlight, contraste maximal |

### Ce qui rend le lot « moderne » (le détail, pas l'intention)

- **Halo SVG réel** : le tube de la porte est un `<path>` dans un filtre
  `feGaussianBlur` double (`stdDeviation` 5 et 12) — un bloom calculé, pas
  une ombre CSS. Le tube se **dessine** puis s'écarte quand `is_allowed`
  répond oui, se resserre et vire au rose sur refus.
- **La porte = l'image du produit** : trois segments de tube. Métaphore
  comprise sans lire une ligne.
- **Courbes de ressort** partout : `cubic-bezier(.34,1.56,.64,1)` pour les
  éléments, `cubic-bezier(.16,1,.3,1)` pour les mouvements.
- **Grain** : SVG `feTurbulence` inline en `mix-blend-mode: overlay` — casse
  le plastique des dégradés, zéro requête réseau.
- **Maille de dégradés** : trois `radial-gradient` superposés en fond fixe.
- **Curseur lumineux** : halo qui suit le pointeur, coupé sur `pointer:coarse`.
- **Bague de progression** : anneau SVG piloté par `stroke-dashoffset`
  (circumférence 119) au lieu de barres — le geste dit « 9 étapes » avant le
  texte.
- **Chiffres à défilement** : les compteurs interpolent en `setTimeout` (pas
  `requestAnimationFrame`, qui se fige en headless — bug corrigé en V3).
- **Ticker** : les 9 étapes défilent en continu sous le CTA.
- **Révélations au scroll** : `IntersectionObserver` + `translateY`.
- **Focus visible, `prefers-reduced-motion`, chiffres tabulaires**.
- **Micro-interactions** : les blocs de code se lèvent au survol, la porte
  secousse sur refus, les pots d'argent s'allument.

### Couverture fonctionnelle (inchangée, 100 %)

Permis (12 pips, statut, caution, coef, casier 3 cases) · porte + codes de
refus · les 9 étapes · argent (caution / fonds / crédit) · machine à temps
0→24 mois · casier hérité par empreinte · 7 benchmarks · 12 codes de refus ·
verdict `DEMO OK (10/10)` + invariant I2.

### Vérifications

- `node --check` sur les 6 scripts : OK.
- 25 identifiants DOM référencés : présents dans les 6.
- **Scénario exécuté en headless Chrome (`?auto=1`) sur les 6** : état final
  vérifié = pts 6, caution 1,25, fonds 0,20, crédit 0,20, inval 1,
  missions 1/1, casier `m-2` rempli, `DEMO OK (10/10)`.
- Captures headless produites pour les 6.

### Organisation des fichiers

- `planches/` — V1 (6 planches descriptives, conservées pour comparaison)
- `planches/v2/` — V2 (6 identités sombres jouables) + lot 1 des variantes
  (mesh, neon, liquid, prism, plasma, eclipse, type, chroma, filament, spot)
- `planches/v2/v3/` — **lot 2, le plus abouti** (néon, aurora, prisme,
  orbite, mono, éclat) + `index.html`

Gabarits conservés : `_tpl.html`/`_gen.ps1` (lot 1), `_tpl2.html`/`_gen2.ps1`
(lot 2). Une variante = ~15 à 40 lignes de CSS.

### Changelog V4

- 6 variantes néon violet, socle neuf, moteur identique.
- Porte en tube SVG avec bloom calculé — signature du lot.
- Grain, maille, curseur lumineux, bague de progression, ticker, révélations.
- `v3/index.html` : vignettes live + tableau de couverture + détail des
  choix de modernité.

---

## V5 — 2026-11-11 · socle v4 (`planches/v2/v4/`) — le concept rendu

Retour de Gaia : « pas assez moderne, le concept n'est pas passé visuellement,
il faut que ce soit percutant, à la fois très visuel, et puis une partie très
technique, et des animations marquantes ».

**Diagnostic.** Les lots précédents *décrivaient* le concept (une jauge, des
puces, des tableaux) au lieu de le **rendre**. Et la partie technique se
résumait à des puces. V5 reconstruit les deux.

### 1. Le permis devient un objet

Le jeton est désormais dessiné comme une **carte officielle**, pas comme un
encadré de tableau de bord :

- **guilloché** : deux réseaux de cercles répétés + trame à 48°, en fond ;
- **perforations** à gauche (points en colonne) ;
- **sceau** circulaire et **hologramme** conique animé ;
- **microtexte** en capitales espacées, **filet** de pied ;
- **portrait = l'empreinte** : matrice 13×13 de pixels **générée en JS depuis
  le hash** `fp:9f2c…a41e`. L'identité est littéralement une donnée ;
- **rangée de 12 points** comme sur un vrai permis : cases pleines, vides, et
  rouges barrées à zéro ;
- **scan automatique** : une bande lumineuse traverse la carte en boucle.

### 2. La partie technique devient un panneau de protocole

- **Schéma des deux contrats** : `missions` ↔ `demerit`, arc SVG, et une
  capsule **`is_allowed`** qui traverse l'arc en boucle avec les deux temps
  annotés (« gas statique 10 Tgas » puis « callback `on_allowed` »).
- **Le vrai code** : `effective()` extrait de `contracts/demerit/src/rules.rs`,
  colorisé, avec les quatre « zéro » (keeper, flottant, donnée perso, secret).
- **Vue NEP-171 typée en direct** : le JSON de `nft_token` se remplit
  caractère par caractère et **se met à jour à chaque étape** du scénario.
  Le juge voit la vraie forme de la réponse, pas une illustration.

### 3. Animations marquantes

| Animation | Détail |
|---|---|
| **Overlay de démarrage** | 5 lignes typées (near · nep-171 · règles pures · invariant I2 → prêt) |
| **Titre cinématique** | chaque mot entre en flou + rotation décalée, cascade |
| **Scan de la carte** | bande lumineuse en boucle sur le permis |
| **Hologramme** | dégradé conique en rotation permanente |
| **Portrait généré** | matrice 13×13 recalculée depuis l'empreinte |
| **Capsule protocolaire** | `is_allowed` traverse l'arc en boucle |
| **Ondes de choc** | anneau sur la carte à la faute grave + au transfert |
| **Bannières plein écran** | PERMIS DÉLIVRÉ · 0 POINT · CASIER HÉRITÉ · NON TRANSFÉRABLE |
| **Compteurs** | points, caution, fonds, crédit défilent (jamais de saut) |
| **Typing JSON** | la vue NEP-171 se tape en direct à chaque étape |
| **Révélations au scroll** | `IntersectionObserver` + translation |

### Les six variantes

| # | Fichier | Nom | Accent | Traitement |
|---|---|---|---|---|
| 01 | `01-violet.html` | Violet néon | `#A855F7` | bloom maximum, carte blanche sur violet |
| 02 | `02-nuit.html` | Nuit profonde | `#6D28D9` | trame large 104 px, indigo sourd, halo discret |
| 03 | `03-ions.html` | Ions | `#7C3AED` | champ de particules dérivantes, scan rapide |
| 04 | `04-prisme.html` | Prisme | `#8B5CF6` | facettes `clip-path`, pips triangulaires |
| 05 | `05-mecanique.html` | Mécanique | `#7A5AF8` | 100 % monospace, codes en clair, grille 44 px |
| 06 | `06-cinema.html` | Cinéma | `#9D6BFF` | letterbox, vignette, typo 112 px |

### Couverture (100 % conservée)

Permis (carte complète) · 9 étapes · porte + codes de refus · argent ·
casier · machine à temps · casier hérité · **protocole** · **code source** ·
**vue NEP-171 live** · 7 benchmarks · 12 codes · verdict `DEMO OK (10/10)`.

### Vérifications

- `node --check` sur les 6 scripts : OK (51 identifiants DOM, tous présents).
- **Scénario exécuté en headless Chrome (`?auto=1`) sur les 6** : état final
  exact (pts 6, caution 1,25, fonds 0,20, crédit 0,20, inval 1), JSON
  `computed_title` présent, portrait généré (3 lignes actives),
  `DEMO OK (10/10)`.
- Captures headless produites pour les 6.

### Arborescence

- `planches/` — V1 (descriptive)
- `planches/v2/` — V2 + lot 1 (variantes)
- `planches/v2/v3/` — lot 2 (néon, halo SVG)
- **`planches/v2/v4/` — socle v4, le plus abouti** (concept rendu + technique)

Gabarits : `_tpl.html`/`_gen.ps1`, `_tpl2.html`/`_gen2.ps1`,
`_tpl3.html`/`_gen3.ps1`.

### Changelog V5

- Socle v4 : le permis est une carte officielle, la technique est un panneau
  de protocole, la vue NEP-171 est typée en direct.
- 6 variantes du nouveau socle.
- Séquence de démarrage typée + titre cinétique + scan de carte.


---

## V6 — 2026-11-11 · la scène 3D (`planches/v2/v5/`)

Retour de Gaia : « pas assez moderne, le concept n'est pas rendu visuellement,
il faut que ce soit percutant, très visuel, une partie très technique, et des
animations marquantes ». Réponse : **passer en 3D réelle**.

### Le concept, rendu en volume

| Élément | Avant | Maintenant |
|---|---|---|
| Le permis | une carte à plat | une **dalle en perspective** posée sur une grille au sol |
| Le nom | du texte | **gravé sur la dalle** (groupe SVG + matrice isométrique) |
| Les 12 points | une jauge 2D | **12 piliers en volume** qui s'enfoncent un à un |
| La porte | un cadre 2D | un **arc 3D** dont les montants s'écartent |
| L'argent | trois compteurs | trois compteurs + halos + ondes de choc |

### La projection (aucune bibliothèque)

```
écran.x = (x − y) · cos30°
écran.y = (x + y) · sin30° − z
```

Une fonction `iso(x,y,z)`, une fonction `slab()` qui pose une dalle (dessus +
deux chants visibles), et des polygones SVG. La gravure du nom utilise la
**matrice** `[cos30, sin30, −cos30, sin30, tx, ty]` : le texte s'incline
exactement sur le plan de la carte.

**Occlusion vérifiée par le calcul** : les piliers (y monde 16→38) et la
gravure (y monde 120→250) ne peuvent jamais se chevaucher à l'écran — la
condition d'intersection impose `y_texte ≤ y_pilier`, or le texte est toujours
devant. Les piliers sont donc dessinés *après* la carte sans jamais masquer
le nom.

### Les 4 variantes

| # | Fichier | Nom | Accent | Traitement |
|---|---|---|---|---|
| 01 | `3d-01-holo.html` | Hologramme | `#A78BFA` | halo bloom, carte lumineuse |
| 02 | `3d-02-obsidienne.html` | Obsidienne | `#8B7BC7` | verre noir, reflets froids, halo minimal |
| 03 | `3d-03-neongrid.html` | Néon Grid | `#C026D3` | magenta saturé, grille 52 px, bloom partout |
| 04 | `3d-04-clinique.html` | Clinique | `#7C6CF0` | labo : angles droits, pas de shards, halo discret |

### Animations

- **Piliers qui s'enfoncent / remontent** : hauteur tweenée (480 ms, courbe
  en S) avec cascade de 26 ms d'un pilier à l'autre — la perte de points se
  *voit* tomber.
- **Porte qui s'écarte** : offset tweené de 0 → 54, linteau qui s'élargit,
  halo au sol qui grandit, libellé `is_allowed → AUTORISÉ → REFUSÉ`.
- **Parallaxe** : la scène s'incline au pointeur (`perspective` + `rotateX/Y`).
- **Respiration** : la scène flotte lentement (11 s), désactivée en
  `prefers-reduced-motion`.
- **Shards** : 10 éclats qui dérivent à des vitesses différentes.
- Bannières plein écran, flashs, ondes de choc, compteurs, typing JSON —
  conservés du lot précédent.

### Vérifications (exécutées)

- `node --check` : OK sur les 4.
- 56 identifiants DOM référencés : présents sur les 4.
- **Scénario exécuté en headless Chrome (`?auto=1`) sur les 4** :
  59 polygones générés, 12 groupes de piliers, 1 matrice de gravure,
  état final pts 6 / caution 1,25 / fonds 0,20 / crédit 0,20,
  `DEMO OK (10/10)`, **0 erreur JS**.
- Captures 1440×1000 produites pour les 4.

### Changelog V6

- Scène isométrique 3D écrite à la main (projection + dalles + piliers).
- Le permis devient un objet ; les points deviennent des volumes.
- 4 variantes de traitement + `v5/index.html`.
- Gabarits `_tpl5.html` / `_gen5.ps1`.

---

## V7 — 2026-11-11 · la scène pipeline (`planches/v2/v6/`)

Retour de Gaia : « il faut que les **4 acteurs** soient représentés en 3D, un
**cas d'usage**, et qu'un bouton fasse défiler **toute la chaîne**, étape par
étape, pour qu'on comprenne la pipeline en 3D ».

### La scène

Hub-and-spoke isométrique, cinq nœuds + un coffre :

| Position | Acteur | Rôle dans la scène |
|---|---|---|
| haut | **Émetteur** | vérifie l'identité, délivre, agrée, tranche |
| droite | **Plateforme** | publie, interroge le registre, enregistre |
| bas | **Client** | paie, note, reçoit l'indemnité |
| gauche | **Professionnel** | accepte, travaille, délègue, complète la caution |
| centre | **Registre** | monolithe + orbe pulsante ; le hub de tous les appels |
| bas-droite | **Fonds de garantie** | petit coffre collé au registre |

Au-dessus du monolithe flotte la **carte du NFT** avec ses **12 piliers** :
ils montent, tombent, rougissent. Le titre du jeton est affiché en 3D au-dessus
de la carte et se recalcule à chaque étape.

Les liaisons au sol (pointillés isométriques) dessinent la topologie : tout
passe par le centre.

### Le paquet = l'appel

Chaque traversée est un losange lumineux sur un arc calculé (sine en z),
avec l'étiquette de la méthode :

- violet = appel
- **vert** = paiement / réponse positive
- **rouge** = refus, avec le code exact

### Les 18 étapes (cas d'usage : Léa, coursier)

01 vérification d'identité · 02 `issue()` + caution 1 Ⓝ → 6 piliers ·
03 `approve_platform()` · 04 `post(0,8 Ⓝ)` · 05 `accept(m-1)` ·
06 `is_allowed()` → true · 07 attribution · 08 `close(m-1, medium)` ·
09 `record_mission()` · 10 −3 pts, titre recalculé · 11 paiement 0,8 Ⓝ ·
12 régénération +1 pt · 13 faute grave → 0 pt, suspension, 0,20 au client,
0,20 au fonds, coef 1,25 · 14 refus `ERR_LICENSE_SUSPENDED` ·
15 compte recréé → `ERR_IDENTITY_SUSPENDED` · 16 vente → `ERR_SOULBOUND` ·
17 réhabilitation 6 pts · 18 `ERR_UNDER_BONDED` → `top_up_bond` 0,65 Ⓝ → true.

Chaque étape est déclarative (`hi`, `pk`, `set`, `ban`, `flash`) : le moteur
anime dans l'ordre, met le HUD à jour, remplit la barre de progression et
surligne la ligne correspondante dans la liste latérale.

### Les 6 variantes

| # | Fichier | Nom | Accent | Traitement |
|---|---|---|---|---|
| 01 | `p3d-01-holo.html` | Hologramme | `#A78BFA` | orbite lente, halo bloom |
| 02 | `p3d-02-neon.html` | Néon violet | `#C084FC` | magenta saturé, bloom max |
| 03 | `p3d-03-obsidienne.html` | Obsidienne | `#8B7BC7` | verre noir, reflets froids |
| 04 | `p3d-04-clinique.html` | Clinique | `#7C6CF0` | labo, respiration coupée |
| 05 | `p3d-05-terminal.html` | Terminal | `#9F7BFF` | 100 % monospace, angles vifs |
| 06 | `p3d-06-cinema.html` | Cinéma | `#9D6BFF` | letterbox, vignette |

### Vérifications

- `node --check` : OK sur les 6.
- **Scénario exécuté en headless Chrome (`?auto=1`) sur les 6** : 70 polygones
  générés, **18/18 étapes jouées**, état final exact (pts 6 · caution 1,25 Ⓝ ·
  client 0,20 Ⓝ · fonds 0,20 Ⓝ), **0 erreur JS**.
- Captures produites pour les 6.

### Changelog V7

- Scène pipeline 3D : 4 acteurs + registre + fonds, 18 étapes animées.
- Les paquets portent les vrais noms d'appel du dépôt.
- Cas d'usage « Léa, coursier » + 6 autres métiers proposés en section 01.
- Gabarits `_tpl6.html` / `_gen6.ps1` · sommaire `v6/index.html`.

---

## V8 — 2026-11-11 · `/planches 10` pipeline 3D (`planches/v2/v7/`)

Demande de Gaia : garder le violet/noir, **identifier toutes les parties**
(y compris le registre public), rendre lisible la **nature de chaque
interaction**, comprendre **toutes les étapes**, et **afficher un terminal**
sous la scène.

### Ce qui a été ajouté au socle 3D

**1. Étiquettes dans la scène.** Chaque nœud porte une carte d'identité
SVG : nom + compte + rôle, reliée au socle par une tige.

| Nœud | Compte | Rôle affiché |
|---|---|---|
| ÉMETTEUR | issuer.testnet | vérifie · délivre · agrée |
| PLATEFORME | missions.testnet | publie · interroge · enregistre |
| CLIENT | client.testnet | paie · note · est indemnisé |
| PROFESSIONNEL | lea.testnet | détient le jeton · travaille |
| **REGISTRE PUBLIC** | demerit.testnet | lecture gratuite · sans gas |
| FONDS | solde du registre | garantie mutualisée |

Le registre est étiqueté **au-dessus de la carte NFT**, ce qui rend visible
la hiérarchie : le contrat porte le jeton, le jeton porte les points.

**2. Nature des interactions, codée.**

| Visuel | Nature |
|---|---|
| losange blanc/violet | transaction (écrit, signée, gas) |
| losange vert | paiement NEAR (récompense, indemnité, excédent) |
| losange rouge | refus (panic avec code constant) |
| liaison qui s'allume | l'arc emprunté par l'appel |
| `view` dans l'étiquette | lecture gratuite, sans compte |
| `xcc` dans l'étiquette | appel inter-contrats, gaz statique + callback |

Une **légende en deux colonnes** sous la scène rappelle les 6 parties et les
6 natures d'interaction.

**3. Le terminal.** Panneau `near-cli` sous la scène qui s'écrit **en même
temps** que les paquets traversent : commande exacte, événement NEP-297 émis,
valeur renvoyée, code de refus. 90 lignes sur le scénario complet. À gauche,
la liste des 18 étapes se surligne et défile en synchronisation.

**4. Disposition repensée.** Les acteurs ne sont plus sur les diagonales
isométriques mais placés pour leur **rendu écran** : émetteur en haut à
gauche, plateforme en haut à droite, client en bas à droite, professionnel en
bas à gauche, registre au centre, fonds en bas à droite proche du registre.
Le hub-and-spoke est donc lisible d'un coup d'œil.

### Les 10 variantes (violet/noir conservé)

| # | Fichier | Nom | Accent |
|---|---|---|---|
| 01 | `q-01-holo.html` | Hologramme | `#A78BFA` |
| 02 | `q-02-neon.html` | Néon violet | `#C084FC` |
| 03 | `q-03-obsidienne.html` | Obsidienne | `#8B7BC7` |
| 04 | `q-04-clinique.html` | Clinique | `#7C6CF0` |
| 05 | `q-05-terminal.html` | Terminal 3D | `#9F7BFF` |
| 06 | `q-06-cinema.html` | Cinéma | `#9D6BFF` |
| 07 | `q-07-ultraviolet.html` | Ultra violet | `#6D28D9` |
| 08 | `q-08-prisme.html` | Prismatique | `#8B5CF6` |
| 09 | `q-09-blueprint.html` | Blueprint | `#6C7BFF` |
| 10 | `q-10-reacteur.html` | Réacteur | `#7C3AED` |

### Vérifications (exécutées sur les 10)

- `node --check` : OK · 34 identifiants DOM : tous présents.
- **Scénario headless `?auto=1`** : 67 polygones, **6 étiquettes de nœuds**,
  **18/18 étapes**, **90 lignes de terminal**, `DEMO OK (10/10)`,
  **0 erreur JS** — identique sur les 10.
- Captures 860×700 produites.

### Changelog V8

- Étiquettes de nœuds dans la scène + légende des parties et des natures.
- Terminal `near-cli` synchronisé avec les paquets (90 lignes).
- Liste des 18 étapes synchronisée, défilement automatique.
- Positions des acteurs revues pour la lisibilité écran.
- Gabarits `_tpl7.html` / `_gen7.ps1` · sommaire `v7/index.html`.

---

## V9 — 2026-11-11 · REPRISE DE ZÉRO · `/planches 3` (`planches/v9/`)

Reprise par Claude après la passation `RESTART-CLAUDE.md`. Les planches V1→V8
n'ont pas été ouvertes. Trois planches, trois **images** différentes (pas trois
palettes) ; même scénario certifié, mêmes données, même terminal.

### Les trois partis pris

| # | Fichier | Image dominante | Technique | Où sont les 6 parties |
|---|---|---|---|---|
| 01 | `01-porte.html` | **La Porte** : une porte monumentale de lumière, 12 lampes sur le linteau, Léa en silhouette à contre-jour | CSS 3D, caméra qui change de plan | Registre = linteau · Plateforme = la porte · Émetteur et Client = deux guichets latéraux · Pro = la silhouette · Fonds = un puits dans le sol |
| 02 | `02-objet.html` | **L'Objet** : le permis est une dalle épaisse qu'on manipule | CSS 3D, plan produit macro, recto / verso / tranche | Émetteur = le tampon · Plateforme = la barre de scan · Client = le poinçon · Registre = le socle qui projette `check` · Fonds = l'urne · Pro = le nom gravé et le fil |
| 03 | `03-cadran.html` | **Le Cadran** : un anneau de 12 arcs de particules qui est aussi une horloge | canvas 2D, projection maison, particules | l'anneau + le cœur = le jeton de Léa · Registre = le plan qui porte l'anneau · Fonds = un amas dans ce plan · Émetteur, Plateforme, Client = trois corps hors du plan |

Idées propres à chaque planche :

- **01** — l'**ombre** de Léa porte une empreinte : c'est le casier. Au temps 7,
  `lea2.testnet` arrive en pointillés et projette **la même ombre**. La caution
  est une colonne de lumière avec un trait « exigée ». Refus = la porte claque.
- **02** — un point perdu est un **trou** poinçonné dans la dalle ; il cicatrise
  avec le temps. On **retourne** l'objet pour voir la caution couler. La tranche
  porte « fp-lea · NON TRANSFÉRABLE ».
- **03** — **1 grain = 0,01 Ⓝ** : on voit 20 grains partir vers le client et 20
  vers le fonds, puis 65 revenir. L'invariant I2 est visible : aucun grain
  n'apparaît ni ne disparaît. +6 mois = un demi-tour d'anneau.

### Ce qui change par rapport à V1→V8 (réponse au diagnostic)

- **Une seule image par planche.** Le premier écran ne contient que la scène et
  le terminal. Tout le reste du dépôt (barème, appels par partie, vues, 20 codes
  de refus, événements, benchmarks, pourquoi NEAR, autres métiers) est dans une
  **annexe sous la ligne de flottaison**, en jetons et en chiffres, sans phrases.
- **La nature d'une interaction se lit par la forme**, jamais par une troisième
  couleur : plein = transaction, anneau creux = vue gratuite, double =
  inter-contrats, pièces/grains = paiement, bloc inversé = refus, pointillés =
  hors chaîne. Deux couleurs strictes : noir + violet.
- **L'animation raconte** : temps d'arrêt avant chaque impact, changements de
  plan, refus plein cadre, et deux temps (4 et 8a) où **rien n'entre dans le
  cadre** parce qu'il n'y a pas de transaction.
- **Le scénario est celui de `demo/src/main.rs`**, découpé en 18 temps sur les
  9 étapes + préparation + bilan ; le terminal écrit les vraies commandes, les
  vrais événements NEP-297, les vrais codes, et finit sur `DEMO OK (10/10)`.

### Construction

`planches/v9/src/` : `core.js` (scénario, horloge, terminal, lecteur, auto-test),
`annexe.css`, une source par planche, `build.mjs` (assemble chaque planche en
**un seul fichier HTML autonome**, zéro dépendance, polices système),
`verify.mjs` (Chrome headless).

Commandes d'URL : `?auto=1` (joue tout), `?speed=N`, `?stop=<temps>`,
`?at=<temps>:<ms>` (arrêt sur image), `?only=annexe`. Espace = lancer / pause ;
clic sur une étape = y sauter.

### Vérifications (exécutées)

`node verify.mjs` — scénario complet en Chrome headless, `?auto=1` :

```
OK 01-porte.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0
OK 02-objet.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0
OK 03-cadran.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0
```

Captures dans `planches/v9/captures/`. Contrôle visuel fait sur les captures
(repos, temps 1, 3, 5a, 5b, 7, 9, 10, annexe, et un format téléphone).

### Limites connues

- **01 · Porte** : au plan large, les guichets Émetteur et Client restent petits. Au temps 7 (« compte recréé »), il faut regarder le sol pour voir que les deux ombres sont identiques.
- **02 · Objet** : le tampon et le poinçon sont des disques vus de dos ; on comprend « un outil frappe » plus que « tampon » ou « poinçon ». La dalle suspendue est très sombre (c'est voulu). Au temps 9, la dalle tirée cache un instant les montants Client et Fonds.
- **03 · Cadran** : le chiffre des points est un contour géant derrière le cœur de grains et chevauche la ligne « caution ». Les corps Émetteur et Plateforme sortent parfois du cadre quand la caméra bouge. Le sous-agent s'est arrêté (limite d'usage atteinte) ; Claude a vérifié et terminé la planche, sans passe de finition supplémentaire.
- **Mobile** : vérifié sur 01 seulement. À 390 px, la scène se recadre et le terminal reste lisible. 02 et 03 ont des règles mobiles écrites mais non contrôlées.
- **Annexe** : contrôlée sur 01 (`?only=annexe`). Le code est le même sur les trois planches.

### Changelog V9

- Abandon du socle V4→V8 (pipeline isométrique, 10 variantes).
- Nouveau socle commun `core.js` : un seul scénario, un seul terminal, un
  auto-test intégré qui lit l'état final dans le DOM.
- 3 planches, 3 images : La Porte · L'Objet · Le Cadran.
- Annexe commune sous la ligne de flottaison pour tout ce qui n'est pas l'image.
- Sommaire `planches/v9/index.html`.
---

## V10 — 2026-11-11 · `/planches` « plus 3D, plus moderne » (`planches/v9/04-06`)

Trois pistes en vraie 3D WebGL2, écrites à la main. Une seule est terminée :
`04-sceau.html`, un anneau de verre à 12 segments calculé par lancer de rayons
sur un sol miroir. Vérifiée : 18/18 temps, état final exact, 0 erreur JS.
`05-ville` et `06-tunnel` ont été arrêtées en cours de route (limite d'usage) :
leurs sources sont partielles et non vérifiées. Gaia a choisi **02 · L'Objet**,
ce qui clôt l'exploration.

## V11 — 2026-11-11 · `/lock 02` + `/delta` (`planches/v9/02-objet.html`)

Retours de Gaia :
1. **Garder** la version Objet et l'améliorer.
2. **Changer** : humaniser, ou au moins représenter par une icône 3D, chacune des parties.
3. **Changer** : sur la carte `lea.testnet`, humaniser Léa.

### Ce qui a changé

- **Six icônes 3D en volume.** Chaque silhouette est répétée sur 12 couches
  CSS 3D, de la face éclairée vers l'arrière sombre, et l'icône oscille
  lentement sur son socle. Quand une partie agit, son icône s'allume, hoche
  la tête et son halo s'intensifie.

  | Partie | Icône |
  |---|---|
  | ÉMETTEUR | agent en képi, insigne étoilé |
  | PLATEFORME | téléphone avec la liste des missions |
  | PROFESSIONNELLE (Léa) | coursière : casquette, queue de cheval, bandoulière, sac de livraison |
  | CLIENT | personne qui tient son colis |
  | FONDS DE GARANTIE | coffre-fort surmonté de pièces Ⓝ |
  | REGISTRE PUBLIC | édifice public à colonnes |

- **Le portrait de Léa sur la carte.** C'est une vraie photo d'identité
  illustrée en deux tons violets : casquette de coursière, queue de cheval,
  veste, bandoulière, sac. Il est plus grand qu'avant (70 × 86 px).
- **Le même visage sur la carte vierge `lea2.testnet`.** Au temps 7, on voit
  qu'il s'agit d'un autre compte mais de la même personne, ce qui rend lisible
  « le casier suit la personne, pas le compte ».
- Le sceau « ÉMIS » est décalé pour laisser la place au portrait.

### Vérification (exécutée)

```
OK 02-objet.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0
```

J'ai relu les captures du repos, des temps 1, 2a, 3, 5b, 7 et 8c, et des zooms
×2,5 sur les icônes et le portrait.

### Limites

- Les visages des icônes sont volontairement simples (yeux en arc), pour rester
  lisibles à 96 px.
- Les icônes sont en CSS 3D, sans lumière calculée : le volume vient du
  dégradé des 12 couches.
- Format mobile non revérifié après ce changement.

### Changelog V11

- Les anciennes figures (`.pers`, `box3`), qui ne s'affichaient pas, sont
  remplacées par `ico3()` (silhouette extrudée sur 12 couches).
- Nouveau portrait illustré de Léa (`LEA`), sur `lea.testnet` et sur `lea2.testnet`.
- Socles abaissés sous les figures ; icône de Léa agrandie dans l'en-tête.

---

## V12 — 2026-11-11 · `/planches 10` « beaucoup plus 3D, plus modernes » (`planches/v9/11` → `20`)

Demande de Gaia : dix planches beaucoup plus en 3D, plus modernes. Toutes sont
en WebGL2 écrit à la main (lancer de rayons, sauf la 17 qui dessine des
points), sans bibliothèque ni CDN. Toutes partent du moteur de la 04 · Le Sceau
et du brief commun `planches/v9/src/BRIEF-V12.md`. Cinq agents ont travaillé en
parallèle, deux planches chacun. Sommaire : `planches/v9/index.html`.

| # | Planche | Image dominante | Ce qui la distingue |
|---|---|---|---|
| 11 | Carte de verre | dalle de verre réfractive sur un bureau miroir | trous qui percent, portrait gravé, liquide de caution dans la tranche — suite directe de la 02 |
| 12 | Hologramme | projection volumétrique au-dessus d'un socle | scanlines, glitch et découpe en bandes au refus, buste de Léa |
| 13 | Coffre en coupe | coffre monumental écorché | cuve de caution, conduits vers client et fonds, pênes qui claquent |
| 14 | Diorama | ville-maquette en tilt-shift | Léa à vélo livre des colis, un bâtiment par partie, jour/nuit |
| 15 | Toon 3D | personnages en cel-shading | le plus humain : Léa expressive, badge à 12 points qui se fissure |
| 16 | Plateau de jeu | jeu de société sur une table | pions sculptés, jetons-points jetés dans la boîte, sablier, pince |
| 17 | Nuage de points | Léa scannée en 30 000 points | se dissout à 0, se recompose ; 1 grain = 0,01 Ⓝ |
| 18 | Orbitale | planète en coupe | le noyau est la caution, 12 lunes = 12 points, stations orbitales |
| 19 | Brutaliste | hall de béton, puits de lumière | monolithe gravé, éclats de pierre, dalle-porte au refus |
| 20 | Le Sceau, final | anneau verre/métal sur un miroir | éclats physiques, caustiques, figurines |

### Vérification (exécutée par planche)

Pour les dix : `OK NN-xxx.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0`.
Captures dans `planches/v9/captures/NN-*.png`. Claude a relu au moins une image
de chacune.

### Limites connues

- **Ce que le test ne voit pas** : une erreur de compilation du shader est
  attrapée par `init` et n'entre pas dans le rapport d'erreurs JS. Un écran
  vide pourrait donc passer le test : seules les captures le prouvent. Elles
  montrent bien une image pour les dix.
- **Temps de test** : en rendu logiciel headless, un test complet prend de
  2 à 25 minutes par planche.
- **Défauts visibles par planche** :
  - étiquettes qui se chevauchent : 17, 20 (image d'accueil) et 18 (compteur / Émetteur) ;
  - images trop sombres : 19 (granuleuse), 17 et 16 pendant la suspension ;
  - plan du temps 9 raté sur la 20 ;
  - visages simplifiés hors 15 (Toon).
- Sur un GPU réel, le rendu est plus fin et plus fluide que sur les captures
  headless.

### Changelog V12

- 10 nouvelles planches WebGL2 (`src/11-verre.html` → `src/20-sceau.html`).
- Brief commun `src/BRIEF-V12.md`.
- Sommaire refait : les 10 planches V12 avec vignettes, plus les V9 → V11 (02 marquée verrouillée).

---

## V13 → V17 — 2026-11-12 · Three.js, re-brief, choix de la 37

- **V13** (Three.js, `planches/v9/21` → `30`) : Passeport, Musée, Rue néon, Bureau, Cristaux, Tribunal,
  Portique, Typo 3D, Arbre, Téléphone. 21 et 25–30 vérifiées ; 22–24 interrompues (limite d'usage).
- **V14 / V15** (re-brief Gaia, `G-DESIGN/BRIEF-V14.md`) : repartir de zéro, palette libre, site
  avant-gardiste et non jeu, 3D, terminal visible, logo + nom + slogan clair, 6 parties toujours
  visibles, une phrase par étape. 10 planches `31` → `40`, chacune avec son propre gabarit
  (`three/NN-nom.tpl.html`). Toutes vérifiées 18/18 · 0 erreur JS.
- **Choix de Gaia : 37 · Galerie (cylindre)** — « ça c'est bien, il faut le pousser plus loin ».
- **V16** (rejetée : « c'est grossier ») : violet saturé, halo lumineux, cartes blanches épaisses,
  blocs violets pleins dans la légende. Sauvegardée en `three/37-cylindre.*.v16`.
- **V17** (en cours, part de la V15 aimée) : on affine au lieu d'épaissir.
  - Accent cobalt → violet `#6b4dff`, en filets fins sur les anneaux du cylindre ; ombre lilas très douce sous le socle.
  - Caméra un peu plus proche ; le panneau de la partie qui agit avance légèrement.
  - Titre en deux tons ; cartels plus grands, statut en français clair (« Refusé : permis suspendu »).
  - Phrase de l'étape en grande typographie, sans carte, sur un voile clair à peine visible.
  - Chaque code de refus est traduit en clair sous le tampon.
  - Vérifiée : `OK 37-cylindre.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | … | erreurs JS: 0`.

---

## V18 — 2026-11-12 · `/planches 10` « partie 3D moderne, repars de zéro, oublie tout » (`planches/v9/41` → `50`)

Brief : `BRIEF-V18.md`. 34 pistes antérieures interdites, palette libre, 3D vedette, rendu fin (leçon V16).
Exigences fixes conservées : terminal visible, logo + nom + slogan, 6 parties nommées, une phrase par étape.

| # | Piste | Lecture (capture étape 5 · faute grave) |
|---|---|---|
| 41 | Fluide | sombre et irisé ; les bulles-personnages restent floues, à préciser |
| 42 | Pile de cartes | clair, très lisible ; le permis-carte raconte bien la suspension |
| 43 | Paysage | dunes au lever du jour, le plus « cinéma » ; étiquettes un peu nombreuses |
| 44 | Argile | pastel façon Spline, chaleureux et immédiatement compréhensible |
| 45 | Origami | éditorial papier, élégant ; Léa peu visible dans la scène |
| 46 | Bulles | clair et doux ; permis au centre bien lisible |
| 47 | Lumière | silhouettes dans des portes rouge/orange, le plus graphique et frappant |
| 48 | Tissu | galerie claire, étoffe à 12 bandes ; sobre, un peu vide |
| 49 | Isométrie | façon Stripe/Linear, la plus « produit SaaS » et la plus claire |
| 50 | Kinetic | sculpture d'anneaux et de lames |

### Vérification
`node verify.mjs NN- --shots=1,5b,7,10` sur les 10 : toutes `OK 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | DEMO OK (10/10) | erreurs JS: 0`.
Les agents ont été coupés par la limite d'usage ; la vérification finale et la relecture des captures ont été refaites à la reprise.

### Changelog V18
- 10 nouvelles planches Three.js 41 → 50, chacune avec sa propre direction artistique (palette, typo, matière).
- Sommaire `planches/v9/index.html` : nouvelle section V18 en tête.
- Rien de V1 → V17 n'est modifié.

---

## V19 — 2026-11-12 · `/variantes` de la 49 · Isométrie (`planches/v9/51` → `58`)

Gaia retient la 49 et demande des variantes « extrêmement modernes et plus immersives en 3D », puis :
« le carré blanc doit être plus grand » et « de vraies grosses variantes, plus modernes ». Brief : `BRIEF-V19.md`.

Socle commun `src/three/iso-base.mjs` (49 rendue paramétrable ; `49-isometrie.js` intact) : caméra perspective
à cadrage auto + orbite lente + parallaxe souris, travelling, verre, reflets, bloom, profondeur de champ, occlusion,
sols (miroir, infini, vide), poussière, plateau agrandi (14,6 → 23-28), modes monochrome / arêtes / irisé / grille.

| # | Variante | Famille |
|---|---|---|
| 51 | Nuit · verre | immersion |
| 52 | Travelling | immersion (caméra) |
| 53 | Lévitation | immersion |
| 54 | Studio | immersion (matière) |
| 55 | Monochrome | grosse variante : porcelaine blanche, couleur seulement sur la partie qui agit |
| 56 | Grille | grosse variante : dev tool sombre, arêtes néon |
| 57 | Irisé | grosse variante : nacre irisée, fond vivant |
| 58 | Plan | grosse variante : plan d'architecte au trait bleu |

### Vérification
`verify.mjs NN- --shots=1,5b,7` : les 8 `OK 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | erreurs JS: 0`.
Corrections après relecture : plateau sombre éclairci à tort (51, 56), étiquettes qui chevauchaient le slogan
pendant le travelling (52 : les parties qui n'agissent pas s'effacent), rendu délavé (53, 57 : bloom retiré),
plateau invisible sur fond blanc (55 : sol plus soutenu).

### Changelog V19
- 8 variantes 51 → 58 de la 49, sommaire : section V19 en tête. Rien d'antérieur modifié.

---

## V20 — 2026-11-12 · 10 terminaux pour la 58 · Plan (`planches/v9/61` → `70`)

Gaia retient la **58 · Plan** (V19) et demande « 10 apparences cohérentes avec le nouveau design pour le terminal ».
Scène 3D identique (réglages partagés `src/three/plan-opts.mjs`), seule la console change (`NN-nom.css`).

| # | Terminal | Idée |
|---|---|---|
| 61 | Papier | la console est la même feuille que la scène : papier bleu pâle, quadrillage, encre bleue, filet fin |
| 62 | Cartouche | cartouche de plan d'architecte : cases à filets bleus, intitulés en petites capitales, étapes numérotées en cellules |
| 63 | Calque | papier calque translucide posé sur la scène : flou, on devine les blocs à travers, encre bleue |
| 64 | Cyanotype | le vrai bleu d'architecte : fond bleu de Prusse, quadrillage blanc, texte blanc au tire-ligne |
| 65 | Règle | les étapes deviennent une règle graduée : graduations fines, curseur bleu qui avance, terminal en dessous |
| 66 | Millimétré | papier millimétré d'ingénieur : grille fine et grille forte, marge orange, encre bleue |
| 67 | Flottante | console en carte flottante à deux colonnes : les étapes en liste verticale à gauche, le terminal à droite |
| 68 | Encre | terminal noir façon outil de développeur, sans rondeurs, filets et accents bleu plan |
| 69 | Fenêtre | fenêtre d'application claire avec barre de titre et trois pastilles, comme un vrai terminal macOS |
| 70 | Ticket | bande de téléimprimeur : papier crème, bord perforé, séparateurs en pointillés, tout en mono |

### Vérification
`verify.mjs NN- --shots=5b`, un par un : les 10 `OK 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | erreurs JS: 0`.
Corrigé après relecture : fonds quadrillés mal écrits en CSS (61, 64, 66 retombaient sur le bleu nuit, illisible),
étiquettes collées aux valeurs (62), graduations absentes (65).

### Changelog V20
- 10 planches 61 → 70, sommaire : section V20 en tête. 58 et antérieures non modifiées.

---

## 🔒 LOCK — 2026-11-12 · design retenu : `planches/v9/65-regle.html`

Choix de Gaia : scène **58 · Plan** (V19) + terminal **65 · Règle** (V20).
- Scène : plan d'architecte, blocs en verre clair dessinés au trait bleu `#2f5bff`, papier quadrillé `#f5f7ff → #eef2ff`,
  grand plateau (28), perspective téléobjectif (fov 18), la partie qui agit se remplit de matière.
- Terminal : console blanche, étapes sur une règle graduée (55 graduations fines, 11 fortes), curseur bleu sur l'étape en cours.
- Sources : `src/three/iso-base.mjs` + `plan-opts.mjs` + `65-regle.{js,css,tpl.html}`. Vérifiée 18/18 · 0 erreur JS.
- Le verrou précédent (02 · L'Objet, V11) est levé.

---

## V21 — 2026-11-12 · `/planches` « modernise la planche existante » (65 verrouillée → `planches/v9/71` → `80`)

Base : 65 (scène 58 Plan + terminal Règle), qui reste verrouillée et intacte. Chaque planche pousse un levier de modernité.
Socle : ajout de la mise en évidence des arêtes de la partie qui agit (`edgeOn`, `edgeDim`, `fillMin`).

| # | Planche | Levier |
|---|---|---|
| 71 | Typo XXL | typographie géante façon site d'agence : slogan et phrase d'étape en très grand, interface réduite au minimum |
| 72 | Plein écran | la scène occupe tout l'écran, la règle et le terminal flottent en verre au bas de l'image |
| 73 | Bento | l'interface autour de la scène est rangée en cartes « bento » : marque, étape, compteur, chacune dans sa case |
| 74 | Plan de nuit | le même plan en version nuit : papier bleu marine, trait bleu ciel, la partie qui agit s'allume |
| 75 | Mono bleu | une seule couleur : tout est bleu plan, sans aplats multicolores ; la partie qui agit se remplit de bleu |
| 76 | Compteur géant | le permis devient le héros : un compteur de points géant à gauche, qui chute et remonte avec le scénario |
| 77 | Aurore | un halo de couleur doux et lent derrière le plan, comme les pages produit 2026 ; le trait reste net |
| 78 | Signal | seules les arêtes de la partie qui agit s'allument en orange vif ; tout le reste s'efface en filigrane |
| 79 | Travelling | la caméra du 52 sur le plan : elle s'approche des parties qui agissent, les autres étiquettes s'effacent |
| 80 | Éditorial | mise en page de magazine d'architecture : titre en serif, filets fins, numéro d'étape en grand chiffre |

### Vérification
`verify.mjs NN- --shots=5b`, un par un : 65 et 71 → 80 `OK 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | erreurs JS: 0`.
Corrigé après relecture : slogan géant sous l'étiquette Émetteur (71, scène décalée), « 0 » trop fin pris pour un « O » (76),
halo masqué par le fond opaque de la scène (77, fond rendu transparent).

### Limites
- 77 : le halo n'apparaît qu'en bordure, le grand plateau couvre le centre.
- 75 : les objets posés sur les blocs (pièces, colis) gardent leurs couleurs.

### Changelog V21
- 10 planches 71 → 80, sommaire : section V21 au-dessus du design retenu.

---

## V22 — 2026-11-12 · `/delta` sur la 42 · Pile de cartes (« améliore, modernise »)

Retenue par Gaia. Passe d'affinage (leçon de la V16 : ne pas alourdir). Source d'origine gardée en
`three/42-cartes.*.v18`.
- **Netteté** : toutes les cartes imprimées en 2048 × 1288, anisotropie 16 : textes et guillochis nets.
- **Verre** : irisation et velours très discrets ; le reflet change avec l'angle. Contre-jour froid qui détache les tranches.
- **Permis** : carte un peu plus grande et plus proche, chiffre des points en graisse fine, liseré holographique en tête.
- **Fond** : deux lueurs très douces (bleu lavande, rose) derrière la pile ; ombre portée plus profonde et plus douce.
- **Étiquettes** : pastilles de verre dépoli, plus lisibles par-dessus les cartes.
- **5b** : les pièces passent derrière le permis au lieu de le masquer.
- Essai rejeté pendant la passe : imprimer le nom en grand sur chaque carte (on le voyait à travers le verre des cartes de devant).
- Vérifiée : `OK 42-cartes.html | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0`.

## 🔒 LOCK FINAL — 2026-11-12 · 42 · Pile de cartes (V22)

Gaia verrouille la V22 de la 42 (« Oui, on verrouille »). Elle **remplace la 65** comme design de référence.
Fin des explorations ; place aux deltas. Passation opencode : `HANDOFF.md` (racine du dépôt).

---

## V23 — 2026-11-13 · `/planches 6` « génère-en de tout nouveaux » (`planches/v9/81` → `86`)

Gaia, en revoyant les captures V18 : « ça c'est les anciens, génère-en de tout nouveaux ». Brief : `BRIEF-V23.md`.
Toutes les pistes 01 → 80 interdites ; six idées 3D jamais essayées dans le projet. Le lock 42 reste en place tant que Gaia ne choisit pas autre chose.

| # | Piste | Lecture (capture 5b · faute grave) |
|---|---|---|
| 81 | Dominos | sombre, laque noire et ivoire ; les dominos du permis à terre, lignes de dominos dorés vers client et fonds |
| 82 | Mouvement horloger | calibre ouvert anthracite et or ; barillet à 0, aiguille de caution à 0,60, la plus « objet de luxe » |
| 83 | Circuit de billes | clair, bouleau et laiton ; la trappe du silo s'ouvre, billes d'or vers la vasque et le gobelet ; la plus pédagogique |
| 84 | Jetons | sombre et chaud, sol de graphite qui reflète ; jetons de laiton qui glissent ; socles un peu massifs |
| 85 | Gonflable | pastel bleu, vinyle brillant ; coussin à plat marqué 0, ballon doré de la caution ; la plus immédiate |
| 86 | Mobile | galerie beige, tôles peintes façon Calder et leurs ombres ; le mobile a basculé ; la plus graphique |

### Vérification
Reconstruction finale `build3.mjs` des 80 → 86 puis `verify.mjs NN-` sur chacune (exécuté le 2026-11-13) : les 7 sortent
`OK … | 18/18 temps | pts 6 · caution 1,25 · client 0,20 · fonds 0,20 | 59 lignes | « DEMO OK (10/10) » | erreurs JS: 0`.
Captures relues : 1, 3, 5b, 7, 9, 10 par les agents ; 5b relue par Claude sur les six.

### Limites connues
- 81 : seules 6 des 12 places portent un domino (plafond de probation) ; petits recouvrements de textes de rôle.
- 82 : noms sur plaquettes HTML (pas gravés) ; blocage de l'échappement discret en image fixe.
- 83 : contraste modéré ; étiquette du fonds parfois écartée de sa vasque.
- 84 : monnayeur lu comme un pilier ; jetons en vol sur le compteur en 5b.
- 85 : X du refus 7 posé sur la pile du registre ; le coussin ne traverse pas jusqu'au client en 9.
- 86 : tiges croisées pendant la bascule ; étiquettes grises fines sur les ombres.
- Toutes : vérifiées en 1440 × 900 seulement.

### Changelog V23
- 6 nouvelles planches Three.js 81 → 86, chacune avec sa direction artistique propre.
- Sommaire `planches/v9/index.html` : section V23 sous le design retenu.
- Rien de V1 → V22 n'est modifié (80, 85, 86 reconstruites à l'identique depuis leurs sources).

---

## V24 — 2026-11-13 · Option A « vrai site web » pour la vidéo de démo (`G-DESIGN/app/`)

Retours de Gaia sur les vidéos V1 : tout en anglais, problème pas assez clair, pas assez « un site qu'on utilise »,
`demerit` trop petit, terminal et blocs illisibles, terminal qui chevauche la 3D. Trois mises en page proposées
(A vrai site web, B deux côtés, C téléphone + page publique) → **Gaia choisit A**.

- Site produit en anglais, clair et sobre : en-tête avec logo `demerit` grand (30 px) + « The points licence for gig workers »,
  barre latérale (My licence, Jobs, Wallet, Public check), sélecteur de compte (Léa · courier, Sam · customer, lea2 · new account).
- Le journal « On-chain activity » a sa propre bande en bas (178 px, mono 14 px) : jamais par-dessus le site.
- Vraie logique : `moteur.js` (portage 1:1 des contrats Rust) ; chaque bouton exécute l'appel et affiche les vrais événements
  NEP-297, l'appel inter-contrats `is_allowed`, les codes de refus traduits en anglais simple.
- Parcours cliqué de bout en bout, vérifié : licence (identité → dépôt 1 Ⓝ) → job accepté → livré → noté → faute « Damaged » −3
  → +6 mois (+1 pt, aucune transaction) → « Lost parcel » −6 → suspendue, client indemnisé 0,20 → job refusé → compte lea2 refusé
  → +6 mois, dépôt trop bas → complément → accepté → vente refusée (soulbound) → agent IA délégué → retrait du client.
  État final : 6 pts, caution 1,25 = exigée 1,25, 0 erreur JS.
- « Public check » lit le vrai registre `ledger.demerit.testnet` sur NEAR testnet (JSON-RPC, sans wallet).
- Captures : `G-DESIGN/captures-app/`. Lancer : `node G-DESIGN/app/serve.mjs 8120`.

## V25 — 2026-11-13 · `/delta` : moderniser, noir + violet néon, terminal travaillé

- Thème sombre : fond noir `#06040b` avec deux halos violets très doux, surfaces `#0d0917`/`#140f22`, accent néon `#a46bff`/`#c69bff`.
- Boutons principaux en dégradé violet avec halo néon ; navigation active soulignée d'un trait néon ; permis avec liseré holographique.
- Terminal : fenêtre à part (3 pastilles, titre `near-cli · on-chain activity`), numéros de ligne, curseur clignotant,
  pastilles « I2 ✓ every NEAR accounted » et « sandbox · same code as testnet », couleurs par type (commande, appel
  inter-contrats, événement, refus, succès), légère trame d'écran ; ne recouvre jamais le site.
- Parcours complet revérifié au clic : état final 6 pts, caution 1,25 = exigée, 0 erreur JS. Captures : `G-DESIGN/captures-app/`.

## V26 — 2026-11-13 · `/planches 5` « restart from zero » d'après 7 sites de référence (`planches/v26/91` → `95`)

Références regardées en 1440×900 :
- iterate.inc ;
- hackodds-live ;
- 1x.tech ;
- landonorris.com ;
- microsoft.ai ;
- terminal-industries.com ;
- awwwards 3D : la page est bloquée par le bandeau cookies, seuls les noms des sites ont été relevés.

« tracktrend » : pas d'URL, non trouvé.

Socle commun à toutes les planches (`common.js`) :
- logo + nom « demerit » ;
- slogan « Reputation you can lose, not sell. » ;
- les 5 parties (Léa, Sam, Platform, Registry, Fund) avec leurs comptes `.testnet` ;
- un terminal `near-cli` qui tape les vrais événements et refus, jamais sous la 3D ;
- 3D en Three.js 0.160.

| # | Nom | Inspiration | Fond / accent | 3D |
|---|---|---|---|---|
| 91 | Blueprint | iterate | blanc cassé + indigo, mono | ruban filaire : une arête par mission, un creux pour la faute |
| 92 | Glass | hackodds | noir fumé + crème, serif italique | planète NEAR, liseré atmosphère, orbite + satellite |
| 93 | Humanist | 1X + microsoft.ai | ciel chaud pêche/bleu + orange | 5 silhouettes mates (une par partie), anneau de Léa lumineux |
| 94 | Pit wall | Lando Norris | olive + citron vert, Anton | licence en carte physique, liseré lime, signature tracée |
| 95 | Yard OS | terminal-industries | noir + vert + lilas | ville en nuage de points, 5 volumes filaires, colis sur les routes |

Contrôles : capture headless GPU de chaque planche, aucune erreur JS, chevauchements 3D/texte corrigés (92 débordement, 93 étiquettes, 94 carte, 95 cadrage).
Planche contact : `planches/v26/captures/planche-contact.jpg` · index : `planches/v26/index.html`.

**Recommandation : 93 Humanist.** C'est la seule qui « humanise » vraiment les cinq parties, une demande qui revient depuis le début. Elle reste lisible, et elle se démarque nettement des sites crypto noir et violet.
Second choix : 95 Yard OS, la plus « plateforme / réseau » ; elle montre bien que chaque app interroge le même registre.

Changelog V25 → V26 : on repart de zéro (le noir + violet n'est plus imposé), 5 directions au lieu d'une, les parties deviennent des objets 3D, et le terminal est intégré à chaque mise en page.
