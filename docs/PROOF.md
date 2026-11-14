# PREUVE — les quatre commandes, exécutées pour de vrai

Chaque fichier de `docs/proof/` est la sortie **brute** d'une exécution réelle sur
le R630 (`hostname: debian`), horodatée en tête et en queue de fichier, avec la
ligne `EXIT <code>` en dernière ligne. Rien n'est recopié à la main, rien n'est
maquillé : si une commande avait échoué, sa sortie d'échec serait là.

- Hôte : `debian` (Dell R630) · dépôt : `near_demerit` · branche `feat/proof-page`
- Outils : `cargo 1.100.0`, `rustc 1.100.0`, `make`, `node v22.12.0`
- Fenêtre d'exécution : 2026-11-14 de `14:19:56Z` à `14:28:36Z` (UTC)
- Aucun secret dans les sorties : les trois scénarios tournent sur un nœud
  sandbox local produit par `near-workspaces`, et `make sim` tourne en mémoire
  sans chaîne du tout.

## Tableau des résultats

| Commande | Résultat attendu | Résultat obtenu | Log |
|---|---|---|---|
| `cargo test -p demerit` | tests unitaires OK | **18 passés, 0 échoué, 0 ignoré** (2 suites : 18 tests unitaires + 0 doc-test) · `EXIT 0` | [`proof/cargo-test-demerit-20261114.txt`](proof/cargo-test-demerit-20261114.txt) |
| `make demo` | `DEMO OK (10/10)` | **`DEMO OK (10/10)`** — 9 étapes du spec + la ligne `I2 conservation` (`9/9 étapes équilibrées`), ligne `funds: … -> OK` · `EXIT 0` | [`proof/make-demo-20261114.txt`](proof/make-demo-20261114.txt) |
| `make attack` | `ATTACK OK (7/7)` avec les 7 refus et leur code d'erreur | **`ATTACK OK (7/7)`** — 7 refus, chacun avec le code attendu (détail ci-dessous) · `EXIT 0` | [`proof/make-attack-20261114.txt`](proof/make-attack-20261114.txt) |
| `make sim` | `SIM OK (5/5)` + invariant I2 | **`SIM OK (5/5)`** — 5 robots OK + `fonds: … = 5.2500 N \| versements 5.2500 N -> OK` · `EXIT 0` | [`proof/make-sim-20261114.txt`](proof/make-sim-20261114.txt) |

Aucun écart entre attendu et obtenu. Les quatre commandes sortent 0.

## Les 7 refus de `make attack`

| # | Attaque | Code attendu | Code réellement renvoyé | Verdict |
|---|---|---|---|---|
| 1 | un compte non agréé enregistre une mission | `ERR_NOT_PLATFORM` | `code ERR_NOT_PLATFORM` | OK |
| 2 | la même mission est enregistrée deux fois | `ERR_MISSION_ALREADY_RECORDED` | `code ERR_MISSION_ALREADY_RECORDED` | OK |
| 3 | un second permis pour une empreinte déjà titulaire | `ERR_IDENTITY_ALREADY_LICENSED` | `code ERR_IDENTITY_ALREADY_LICENSED` | OK |
| 4 | le titulaire transfère son permis | `ERR_SOULBOUND` | `code ERR_SOULBOUND` | OK |
| 5 | un délégué révoqué accepte une mission | `refus ERR_DELEGATION_EXPIRED` | `état=open accept=ERR_LICENSE_REFUSED registre=ERR_DELEGATION_EXPIRED` | OK |
| 6 | une plateforme suspendue enregistre une mission | `ERR_PLATFORM_SUSPENDED` | `agrément actif=false · code ERR_PLATFORM_SUSPENDED` | OK |
| 7 | le titulaire retire sa caution sous le montant exigé | `ERR_UNDER_BONDED` | `sous-garanti 0.6000 NEAR < 1.2500 NEAR · code ERR_UNDER_BONDED` | OK |

Lecture du refus n° 5 (et du pas 6 de la démo, même forme) : l'acceptation de
mission passe par deux contrats. Le contrat `missions` répond
`ERR_LICENSE_REFUSED` — il ne connaît que « cette licence ne permet pas de
prendre cette mission » — et c'est le registre `demerit` qui porte la raison
précise, `ERR_DELEGATION_EXPIRED`. Le scénario vérifie le code du registre, qui
est celui du spec ; le code du contrat n'est pas un code d'erreur du spec.

## Invariant I2

Formulation de [`ABI.md`](ABI.md) : `Σ bonds + fund + Σ credits + prix des
missions en cours = Σ versements − Σ retraits`.

- `make demo` : l'invariant est revérifié **après chacune des 9 étapes** (pas
  seulement à la fin), rendu par la ligne `I2 conservation | équilibré après
  chaque étape (9) | 9/9 étapes équilibrées | OK`, puis une dernière fois avec
  l'escrow après un vrai retrait :
  `funds: fonds 0.2000 NEAR + cautions et crédits 1.2500 NEAR + missions 0.0000 NEAR = 1.4500 NEAR | versements 1.6500 NEAR - retraits 0.2000 NEAR = 1.4500 NEAR -> OK`
- `make sim` : même conservation, sur 24 mois simulés et 5 robots, sans chaîne :
  `fonds: caution 4.8500 N + garantie 0.2000 N + indemnités 0.2000 N = 5.2500 N | versements 5.2500 N -> OK`

## Les 5 robots de `make sim`

| Robot | Points | Plafond | Suspensions | Coef. | Caution | Attendu | Verdict |
|---|---|---|---|---|---|---|---|
| fiable | 10 | 10 | 0 | 90 | 1.0000 N | au plafond, coefficient < 1, excédent retirable | OK |
| moyen | 10 (10–12) | 12 | 0 | 100 | 1.0000 N | oscille entre 9 et 12, jamais suspendu | OK |
| négligent | 0 | 6 | 31 | 100 | 1.0000 N | suspendu au moins une fois | OK |
| fraudeur (2ᵉ compte) | 6 | 6 | 1 | 125 | 1.2500 N | hérite du casier et paie une caution plus chère | OK |
| plateforme abusive | — | — | 3 avert. | — | suspendue | agrément suspendu au troisième avertissement | OK |

## Page « Proof » en lecture seule

`web/proof.html` affiche ces mêmes chiffres. Ils ne sont pas saisis à la main :
`web/scripts/proof-summary.mjs` (node, sans dépendance) analyse les quatre
`.txt` de `docs/proof/` et écrit `web/proof.json`, que la page lit par `fetch`.
Un log absent ou illisible produit une page d'erreur propre, jamais un crash, et
jamais un chiffre inventé. Régénérer :

```
cd web && node scripts/proof-summary.mjs
```

## Vérifications autour de ce changement

- `make web-v28` → `V28 CHECK OK (17/17)`, 0 échec. (Le contrat de la tâche
  mentionnait 14/14 : la branche `main` a reçu entre-temps les vérifications
  supplémentaires du terminal live, ce qui porte le total à 17. La valeur
  réelle, lue dans la sortie, est 17/17.)
- `web/proof.html` chargée en Chrome headless : 17 assertions sur 17 passent —
  0 erreur JavaScript, les 4 tuiles (18 tests, 10/10, 7/7, 5/5), les 7 lignes de
  refus avec leurs codes, les 5 robots, les 10 lignes de la démo, l'invariant I2
  et les 4 liens de provenance ; et, `proof.json` rendu indisponible par le
  serveur, le bandeau d'erreur s'affiche sans chiffre résiduel.
