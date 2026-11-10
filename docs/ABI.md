# ABI — contrats `demerit` et `missions`

> Contrat de référence entre les lots. Toute signature ci-dessous est figée :
> les démos, la page web et les tests s'écrivent contre ce document.

Tous les temps sont des **nanosecondes** (`env::block_timestamp()`).
Tous les montants en yoctoNEAR circulent en **chaînes décimales** (JSON n'a pas d'entier 128 bits) ;
les deux champs `Rules.severe_compensation` et `Rules.contest_deposit` sont donc sérialisés en chaîne.
Tous les montants sont des **yoctoNEAR** (`U128` en JSON, chaîne de caractères).
Tous les refus sont un `panic!` dont le message est un code de `errors.rs`.

## 1. `demerit` — le registre

```rust
#[init] fn new() -> Self                       // issuer = predecessor_account_id()
```

### Émetteur

| Méthode | Args JSON | Effet |
|---|---|---|
| `create_category` | `{ "id": "coursier", "rules": Rules, "base_bond": "1000000000000000000000000" }` | crée la catégorie, version de barème 1 ; refuse `ERR_CATEGORY_EXISTS` |
| `publish_rules` | `{ "category": "coursier", "rules": Rules }` | ajoute une version (non rétroactive) ; renvoie `u32` |
| `approve_platform` | `{ "category": "coursier", "account": "missions.testnet" }` | agrée une plateforme |
| `issue` | `{ "account": "lea.testnet", "category": "coursier", "identity": "fp-hex" }` **payable** | délivre un permis probatoire ; la caution jointe doit valoir la caution exigée (`base_bond × coefficient`) |
| `resolve_contest` | `{ "category": "coursier", "mission_id": "m-1", "upheld": true }` | confirme (upheld=true) ou annule le signalement |
| `strike_platform` | `{ "account": "missions.testnet" }` | avertissement manuel (appelant : émetteur) ; aussi appliqué quand un recours est gagné ; 3 avertissements → `active = false` |
| `revoke_license` | `{ "account": "lea.testnet", "category": "coursier", "reason": "fraude" }` | révoque (fraude) |

### Plateforme agréée

| Méthode | Args JSON | Effet |
|---|---|---|
| `record_mission` | `{ "actor": "lea.testnet", "category": "coursier", "mission_id": "m-1", "outcome": "clean\|light\|medium\|severe", "client": "client.testnet", "evidence": "sha256:…" }` | met à jour points et compteurs, suspend à zéro, indemnise le client sur `severe`, prélève la caution |

`outcome` inconnu → `ERR_BAD_OUTCOME`. Mission déjà vue **pour cette plateforme** → `ERR_MISSION_ALREADY_RECORDED`.
Appelant non agréé → `ERR_NOT_PLATFORM`. Plateforme suspendue → `ERR_PLATFORM_SUSPENDED`.

### Titulaire

| Méthode | Args JSON | Effet |
|---|---|---|
| `top_up_bond` | `{ "category": "coursier" }` **payable** | complète la caution |
| `withdraw_bond_excess` | `{ "category": "coursier" }` | retire l'excédent au-dessus de la caution exigée |
| `delegate` | `{ "category": "coursier", "delegate": "agent1.lea.testnet", "expires_at": "1790000000000000000" }` | ouvre une délégation |
| `revoke_delegate` | `{ "category": "coursier", "delegate": "agent1.lea.testnet" }` | la ferme |
| `contest` | `{ "category": "coursier", "mission_id": "m-1" }` **payable** (dépôt) | ouvre un recours dans la fenêtre |
| `claim_stage` | `{ "category": "coursier" }` | +4 points si `streak_ok ≥ stage_streak` et un stage par an |
| `renounce` | `{ "category": "coursier" }` | rend le permis : crédit du solde de caution après la fenêtre de réclamation |
| `withdraw` | `{}` | retire le crédit de l'appelant |

### Vues

| Méthode | Args JSON | Renvoie |
|---|---|---|
| `status` | `{ "account": "lea.testnet", "category": "coursier" }` | `StatusView` (voir `model.rs`) |
| `is_allowed` | `{ "account": "lea.testnet", "category": "coursier", "min_points": 9 }` (`min_points` optionnel) | `bool`, calculé à l'instant de l'appel |
| `check` | `{ "account": "…", "category": "…", "requirements": { "min_points": 9, "min_missions": 5, "max_invalidations": 0, "min_age_months": 12, "max_coefficient": 150 } }` | `{ "allowed": bool, "code": Option<String> }` |
| `license` | `{ "token_id": "demerit-1" }` | l'enregistrement brut `License` |
| `license_of` | `{ "account": "…", "category": "…" }` | l'enregistrement brut du permis vivant |
| `platform` | `{ "account": "missions.testnet" }` | `{ "active": bool, "warnings": u8, "approved_at": u64 }` |
| `delegation` | `{ "delegate": "agent1.lea.testnet", "category": "coursier" }` | `{ holder, delegate, category, expires_at } \| null` |
| `fund` | `{}` | `U128` |
| `credit` | `{ "account": "lea.testnet" }` | `U128` |
| `rules` | `{ "category": "coursier", "version": 1 }` | `Rules` |
| `categories` | `{}` | `[{ id, issuer, base_bond, versions }]` |
| `clock` | `{}` | `U64` (nanosecondes, chaîne JSON) — sert aux démos pour attendre une échéance |
| `issuer` | `{}` | `AccountId` de l'émetteur |

### NEP-171 / NEP-181 / NEP-393 (lecture seule)

`nft_metadata`, `nft_token({token_id})`, `nft_tokens({from_index, limit})`,
`nft_supply_for_owner({account_id})`, `nft_tokens_for_owner({account_id, from_index, limit})`.

`nft_token` calcule son titre à la lecture : `"Coursier · 9/12 · valide"`.
`nft_transfer` et `nft_transfer_call` paniquent `ERR_SOULBOUND`.

### Argent

- Émission : la caution jointe part dans `bond` du permis.
- Signalement grave : `compensation = min(rules.severe_compensation, bond)`, créditée au **client** (retirable par `withdraw`) ; `fund_share = bond_avant × fund_share_pct / 100`, versée au **fonds** ; le reste est prélevé sur la caution.
- Recours gagné : le fonds rembourse la caution prélevée, le client garde l'indemnité si la plateforme a fauté, la plateforme prend un avertissement.
- Recours perdu : le dépôt va au fonds.
- Invariant I2 : `Σ bonds + fund + Σ credits + prix des missions en cours = Σ versements − Σ retraits`.

## 2. `missions` — la plateforme de démonstration

```rust
#[init] fn new(registry: AccountId, category: String, min_points: Option<u8>) -> Self
```

| Méthode | Args JSON | Effet |
|---|---|---|
| `post` | `{ "reward": "1000000000000000000000000" }` **payable** (≥ reward) | publie une mission, renvoie `u64` |
| `accept` | `{ "mission_id": 1 }` | interroge `demerit.is_allowed(worker, category, min_points)` ; si oui, attribue dans le callback, sinon `panic!` avec le code renvoyé (`ERR_LICENSE_SUSPENDED`, `ERR_UNDER_BONDED`, `ERR_DELEGATION_EXPIRED`, `ERR_LICENSE_REVOKED`) |
| `close` | `{ "mission_id": 1, "outcome": "clean\|light\|medium\|severe" }` | paie le prestataire, puis appelle `demerit.record_mission(...)` |
| `mission` | `{ "mission_id": 1 }` | `{ id, poster, worker, reward, state, outcome }` |
| `missions` | `{}` | liste |

Note : `is_allowed` renvoie un `bool` sans code de refus. Pour afficher le code précis
(`ERR_LICENSE_SUSPENDED`, `ERR_UNDER_BONDED`, …), `missions` lit la vue `check` du registre.

`accept` doit utiliser un appel croisé avec **gas statique** et un callback `on_allowed`
(`Promise::then`), jamais un `env::promise_result` synchrone.

## 3. Codes de refus (voir `contracts/demerit/src/errors.rs`)

`ERR_SOULBOUND`, `ERR_NOT_ISSUER`, `ERR_NOT_PLATFORM`, `ERR_PLATFORM_SUSPENDED`,
`ERR_MISSION_ALREADY_RECORDED`, `ERR_NO_LICENSE`, `ERR_LICENSE_SUSPENDED`,
`ERR_IDENTITY_SUSPENDED`, `ERR_IDENTITY_ALREADY_LICENSED`, `ERR_UNDER_BONDED`,
`ERR_DELEGATION_EXPIRED`, `ERR_CONTEST_WINDOW_CLOSED`, `ERR_STAGE_NOT_ELIGIBLE`,
`ERR_CATEGORY_EXISTS`, `ERR_UNKNOWN_CATEGORY`, `ERR_BOND_TOO_SMALL`,
`ERR_NOTHING_TO_WITHDRAW`, `ERR_NOT_HOLDER`, `ERR_NO_CONTEST`,
`ERR_ALREADY_CONTESTED`, `ERR_BAD_OUTCOME`, `ERR_LICENSE_REVOKED`.
