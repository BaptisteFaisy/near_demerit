# « Permis à points » — cahier des charges

> Ticket 10 `nfts` « NFTs That Do Something ». État au mardi 10 novembre 2026.
> Échéance : **samedi 14 novembre, 23:59 UTC** (dimanche 00:59 à Paris).
> Nom de travail : *Points Licence*. Accroche : *reputation you can lose, not sell*.
> Autres cahiers du ticket : [Toujours à vendre](nfts-1-toujours-a-vendre.md), [Carte cadeau](nfts-3-carte-cadeau.md), [Carnet d'entretien](nfts-4-carnet-d-entretien.md).

## 1. En bref

Un permis professionnel non transférable, adossé à une caution. Ses points baissent quand un vrai client signale une mission et remontent avec le temps. À zéro, toutes les plateformes qui le consultent refusent son titulaire, et sa caution indemnise le client lésé.

| Le NFT… | Comment | Niveau |
|---|---|---|
| ouvre et ferme des portes | n'importe quel contrat lui demande si un compte est autorisé | M |
| se dégrade et se répare | pertes sur signalement, régénération calculée à partir des horodatages | M |
| garde un casier | missions, signalements, invalidations, ancienneté, attachés à la personne et non au compte | M |
| ne se vend pas | transfert refusé | M |
| possède de l'argent | une caution bloquée à l'émission, entamée à chaque invalidation | M |
| indemnise | un signalement grave verse une somme au client, prise sur la caution | V1 |
| fixe sa propre caution | un coefficient de bonus-malus fait baisser ou monter le montant exigé | V1 |
| couvre une flotte | le titulaire délègue son permis à des employés ou à des agents, et répond d'eux | V1 |
| est jugé par ses pairs | recours devant trois titulaires tirés au sort | MAX |

Niveaux : **M** est livré le 14 ; **V1** s'ajoute si M est vert vendredi midi ; **MAX** est l'idée poussée au bout, décrite ici en entier, construite seulement si tout le reste est fini.

## 2. Cadre du hackathon

| Point vérifié | Ce que ça impose ici |
|---|---|
| Clôture samedi 14 novembre, 23:59 UTC | quatre jours de travail, d'où les trois niveaux |
| Deux projets au plus par personne, tous tickets confondus | ce cahier vit seul dans son dépôt ; le README cite l'autre projet s'il y en a un |
| Juges IA d'abord (Claude Code, Codex), jury humain ensuite, sans salle ni public | une commande sans secret qui déroule tout, des robots à la place du public, une page ouverte, une vidéo dans le post X |
| README lu par une machine | étapes numérotées « do X → see Y », rôle précis de NEAR, bibliothèques et code généré par IA déclarés, pas de langage marketing |
| Testnet accepté | tout tourne en bac à sable et sur testnet |
| Ticket 10 | des NFT qui sont des comptes : ils possèdent de l'argent, touchent des redevances, détiennent un inventaire, portent des justificatifs ou des droits d'accès ; appuis : NFT dynamiques, NEP-171, sous-comptes |
| Exemple officiel du ticket | passation du contrôle expliquée, historique par NFT, tests du chemin de transfert, modèle de menace écrit |

## 3. Problème et utilité

- **La réputation est enfermée.** Les étoiles d'une plateforme n'existent pas sur la suivante : un bon prestataire repart de zéro, un mauvais aussi.
- **Elle s'efface en recréant un compte.** C'est la faiblesse de toute réputation en ligne, et plus encore on-chain où un compte ne coûte rien.
- **Elle n'a pas de conséquence financière.** Une mauvaise note ne répare rien pour le client lésé.
- **Elle n'a ni barème, ni recours, ni oubli.** Une note est arbitraire, définitive, et ne dit pas ce qu'elle sanctionne.

Quatre institutions règlent ces problèmes dans la vie courante : le **permis à points** (sanction graduée, régénération, stage), le **bonus-malus** (la conduite change le prix), la **caution professionnelle** (une garantie qui indemnise) et la **prescription** (les fautes anciennes s'effacent). Le projet les réunit dans un seul jeton.

**Pourquoi NEAR.** Les comptes nommés rendent un permis lisible. Les sous-comptes et les clés d'appel de fonction donnent une forme naturelle aux délégations. Un appel entre contrats coûte assez peu pour qu'une plateforme interroge le permis à chaque mission.

**Pourquoi ce ticket.** Le jeton porte un justificatif, possède de l'argent (la caution) et ouvre un droit d'accès (les missions).

**Cadrage optionnel.** Les mêmes règles s'appliquent à des agents IA qui acceptent des missions payées : l'opérateur détient le permis, ses agents agissent par délégation, et il répond d'eux. Ce cadrage rapproche le projet des tickets consacrés aux agents.

## 4. Acteurs

| Acteur | Rôle |
|---|---|
| Émetteur | crée une catégorie de permis et son barème, vérifie l'identité hors chaîne, délivre, agrée les plateformes |
| Plateforme agréée | contrat par lequel passent les missions ; elle seule enregistre le résultat d'une mission close |
| Titulaire | détient le permis, délègue, conteste, demande son stage, peut renoncer |
| Délégué | employé ou agent qui agit sous le permis du titulaire |
| Client | note une mission close, une seule fois, à travers la plateforme |
| Juré | titulaire bien noté, tiré au sort pour trancher un recours |
| Vérificateur | tout contrat ou site qui lit le statut, sans autorisation |
| Fonds de garantie | caisse commune alimentée par les cautions ponctionnées |

## 5. Objets et états

```text
            émission                  plafond atteint
  (rien) ───────────▶ Probatoire ───────────────────▶ Titulaire
                          ▲  │                            │
        fin de suspension │  │ 0 point                    │ 0 point
                          │  ▼                            ▼
                         Suspendu ◀───────────────────────┘

  À tout moment : Révoqué (par l'émetteur), Rendu (par le titulaire),
  Sous-garanti (caution inférieure au montant exigé, niveau V1).
```

| Objet | Contenu |
|---|---|
| Catégorie | profession, émetteur, barème versionné, caution de base |
| Permis | titulaire, catégorie, points, plafond, dates, compteurs, caution, 20 derniers signalements |
| Casier | attaché à l'empreinte d'identité : invalidations, suspension en cours, coefficient |
| Signalement | mission, classe, date, version du barème, état (appliqué, contesté, confirmé, annulé, prescrit) |
| Délégation | délégué, titulaire, échéance, compteur de signalements |
| Recours | signalement visé, dépôt, jurés, votes, décision |

## 6. Règles du mécanisme

Le barème reprend le permis français : 12 points, 6 en période probatoire, stage de 4 points. Les durées sont exprimées en « mois », dont la longueur est un paramètre : trente jours en production, dix secondes en démo.

| Règle | Valeur par défaut |
|---|---|
| capital maximal | 12 points |
| capital probatoire | 6 points ; +2 points de solde et de plafond par année sans signalement, jusqu'à 12 |
| signalement léger, moyen, grave | −1, −3, −6 ; le solde ne descend pas sous 0 |
| régénération | +1 point après 6 mois sans signalement ; solde ramené au plafond après 24 mois sans signalement |
| stage | +4 points après 5 missions consécutives sans signalement, une fois par année |
| invalidation | à 0 point : suspension de 6 mois, puis nouveau permis probatoire |
| caution | montant de base fixé par catégorie ; 20 % vont au fonds de garantie à chaque invalidation |

1. **Émission.** L'émetteur délivre un permis à un compte, pour une catégorie, contre une caution et une empreinte d'identité.
2. **Signalement.** Seule une plateforme agréée enregistre le résultat d'une mission close, une seule fois par mission.
3. **Calcul paresseux.** Points, plafond et statut sont calculés à la lecture à partir des horodatages, puis écrits à l'opération suivante. Rien ne tourne en tâche de fond.
4. **Empreinte.** Un seul permis vivant par empreinte et par catégorie. Le casier suit l'empreinte, pas le compte.
5. **Non-transférabilité.** `nft_transfer` refuse.
6. **Lecture ouverte.** `is_allowed` et `status` répondent à tout le monde, à l'instant de l'appel.
7. **Barème figé par version.** Un signalement est jugé selon la version en vigueur à sa date.
8. **Conservation.** Cautions + fonds de garantie + crédits = versements − retraits.

## 7. L'idée poussée à l'extrême

### 7.1 Une caution qui indemnise (V1)

La caution n'est pas une amende en attente : c'est une garantie pour le client.

- Un signalement grave verse au client une indemnité plafonnée par le barème, prise sur la caution du titulaire et créditée immédiatement.
- En cas de recours gagné par le titulaire, le fonds de garantie rembourse sa caution ; le client garde l'indemnité si la plateforme a fauté, et c'est elle qui reçoit l'avertissement.
- À la renonciation, la caution restante est rendue après un délai de réclamation.
- Niveau MAX : la caution est placée en staking pendant qu'elle est bloquée, et le rendement finance le fonds de garantie.

### 7.2 Bonus-malus : la conduite change le prix (V1)

Chaque casier porte un coefficient, sur le modèle de l'assurance automobile : il part de 1,00, se multiplie par 0,95 à chaque année sans signalement (plancher 0,50) et par 1,25 à chaque signalement grave confirmé (plafond 3,50).

- **Caution exigée = caution de base × coefficient.** Un titulaire sans histoire retire l'excédent : sa bonne conduite lui rend de l'argent.
- Si la caution passe sous le montant exigé, le permis devient **sous-garanti** : `is_allowed` répond non jusqu'au complément.
- Une plateforme peut lire le coefficient pour moduler sa commission.

### 7.3 Le compte recréé (M)

Trois verrous se cumulent.

1. **Empreinte d'identité.** L'émetteur enregistre un haché salé de l'identité vérifiée ; le sel reste chez lui. Recréer un compte ne remet rien à zéro : le nouveau permis hérite des invalidations, de la suspension en cours et du coefficient.
2. **Caution.** Chaque permis immobilise une somme, et le coefficient hérité la rend plus chère après une faute.
3. **Probation.** Un permis neuf démarre à 6 points ; une plateforme peut exiger un minimum de points ou d'ancienneté.

### 7.4 Délégations : la flotte et les agents (V1)

Un titulaire délègue son permis à d'autres comptes, typiquement ses sous-comptes : `agent1.lea.near`, `livreur2.atelier.near`.

- `delegate(category, delegate, expires_at)` ; révocation immédiate.
- `is_allowed(délégué)` est vrai si la délégation est valide et si le permis du titulaire l'est.
- Un signalement contre un délégué retire les points au titulaire et incrémente le compteur du délégué : le titulaire sait lequel de ses agents fait perdre des points.
- Une suspension du titulaire arrête toute la flotte d'un coup.

C'est la forme « permis de conduire pour agents IA » : l'opérateur humain met sa caution en jeu pour ce que font ses agents.

### 7.5 Une justice à deux degrés (V1, puis MAX)

- **Premier degré (V1).** Le titulaire conteste un signalement dans un délai fixé, en déposant une somme. L'émetteur tranche. Signalement annulé : points et dépôt rendus, avertissement pour la plateforme. Signalement confirmé : le dépôt va au fonds de garantie.
- **Jury de pairs (MAX).** Trois jurés sont tirés au sort parmi les titulaires d'au moins 10 points et d'une ancienneté minimale, hors de la plateforme concernée. Vote en deux temps (engagement haché, puis révélation) pour que personne ne suive le voisin. La majorité décide ; les jurés se partagent le dépôt du perdant ; un juré qui ne révèle pas perd son droit de siéger.

### 7.6 Des plateformes elles-mêmes sous surveillance (V1)

Chaque signalement annulé en recours vaut un avertissement à la plateforme. Au troisième, son agrément est suspendu automatiquement : elle ne peut plus enregistrer de mission. Niveau MAX : la plateforme dépose elle aussi une caution, entamée à chaque avertissement.

### 7.7 La crédibilité des clients (MAX)

Le registre compte, pour chaque client, ses signalements et ceux qui ont été annulés. Au-delà d'un seuil d'annulations, ses signalements suivants exigent un dépôt, perdu s'ils sont annulés. Le chantage à la mauvaise note devient coûteux.

### 7.8 Prescription et réhabilitation (MAX)

- Un signalement de plus de 36 mois est prescrit : il ne compte plus et disparaît des vues.
- Après 60 mois sans invalidation, le compteur d'invalidations est remis à zéro.
- L'état correspondant est supprimé, ce qui libère du stockage. L'historique de la chaîne ne contient que des codes de barème et des hachés, jamais de donnée personnelle.

### 7.9 Un barème versionné, non rétroactif (MAX)

L'émetteur publie une nouvelle version du barème avec un préavis. Chaque signalement enregistre la version sous laquelle il a été jugé. Une règle plus sévère ne s'applique qu'aux faits postérieurs ; un recours se juge selon la version d'origine.

### 7.10 Un NFT vraiment dynamique (M, puis MAX)

- **M.** `nft_token` calcule ses métadonnées à la lecture : titre « Coursier · 9/12 · valide », champ `extra` avec points, plafond, statut, ancienneté et coefficient. Le wallet affiche donc l'état du jour sans aucune transaction.
- **MAX.** L'image du permis est un SVG produit par le contrat : jauge de points, couleur de statut, QR code vers la page publique.

### 7.11 Un contrôle en une ligne pour les tiers (M, puis V1)

- **M.** `is_allowed(account, category, min_points)` répond par oui ou non.
- **V1.** `check(account, category, requirements)` accepte plusieurs critères (points, ancienneté, invalidations, missions, coefficient) et renvoie un code de refus lisible.
- La signature `is_allowed(account) -> bool` sert d'interface de porte générique : n'importe quel contrat peut exiger un permis pour une action, par exemple tenir une licence d'exploitation ou écrire dans un registre d'ateliers.

### 7.12 Plusieurs métiers, plusieurs émetteurs (MAX)

Une personne détient un permis par catégorie. Une révocation pour fraude dans une catégorie pose un drapeau visible dans les autres. Deux émetteurs peuvent reconnaître leurs permis par une table d'équivalences publique.

### 7.13 Clés perdues, renonciation, cessation (MAX)

- **Récupération.** L'émetteur demande le déplacement du permis vers un nouveau compte ; il devient effectif après un délai pendant lequel l'ancien compte peut s'y opposer. Le casier suit.
- **Renonciation.** Le titulaire rend son permis ; la caution restante est restituée après le délai de réclamation ; le casier reste attaché à l'empreinte.

### 7.14 Lisible depuis d'autres chaînes (MAX)

Le contrat fait signer par Chain Signatures une attestation « ce compte est autorisé jusqu'à telle date ». Un contrat sur une autre chaîne vérifie la signature sans rien connaître de NEAR.

### 7.15 Une personne, un permis, sans dévoiler l'identité (MAX)

L'empreinte salée suppose de faire confiance à l'émetteur. La version ultime remplace la vérification manuelle par une preuve à divulgation nulle de connaissance issue d'une pièce d'identité : la preuve produit un identifiant unique par catégorie, et rien d'autre.

### 7.16 La preuve par les robots (V1)

`make sim` fait vivre une profession pendant 24 mois simulés, soit quatre minutes.

| Robot | Comportement | Résultat attendu |
|---|---|---|
| `fiable` | jamais signalé | 12 points, coefficient inférieur à 1, excédent de caution retirable |
| `moyen` | un signalement léger sur dix missions | oscille entre 9 et 12 points |
| `negligent` | un signalement moyen sur trois missions | suspendu au moins une fois |
| `fraudeur` | signalement grave, puis recrée un compte | le second compte hérite du casier et paie une caution plus chère |
| `plateforme_abusive` | signale tout ; ses signalements sont annulés en recours | agrément suspendu au troisième avertissement |

La commande imprime le tableau final et vérifie ces cinq résultats, plus la conservation des fonds.

## 8. Parcours

**Titulaire.** Il passe la vérification de l'émetteur, verse sa caution, reçoit le permis dans son wallet. Il accepte des missions ; après une mauvaise passe, la page lui dit combien de temps il reste avant le prochain point et ce qu'il doit compléter comme caution.

**Plateforme.** Elle ajoute un appel à `is_allowed` avant d'attribuer une mission, et un appel à `record_mission` à la clôture. Elle dispose dès le premier jour de la réputation acquise ailleurs.

**Client.** Il clôt sa mission avec une note. Si elle est grave, il voit son indemnité créditée et la retire.

**Émetteur.** Sa console délivre, agrée, tranche les recours. Toutes ses actions émettent un événement public.

**Tiers.** Une page publique affiche le permis d'un compte : aucune connexion, un appel de lecture.

## 9. Exigences fonctionnelles

| N° | Exigence | Niveau |
|---|---|---|
| EF-01 | créer une catégorie avec barème et caution de base | M |
| EF-02 | délivrer un permis probatoire contre caution et empreinte | M |
| EF-03 | refuser un second permis vivant pour la même empreinte ; hériter du casier | M |
| EF-04 | agréer une plateforme ; enregistrer une mission une seule fois | M |
| EF-05 | appliquer le barème, la régénération et le plafond probatoire, calculés à la lecture | M |
| EF-06 | suspendre à zéro point, ponctionner la caution, rétablir en probation | M |
| EF-07 | répondre à `is_allowed` et `status` à l'instant de l'appel | M |
| EF-08 | refuser tout transfert ; exposer les vues NEP-171 et NEP-181 avec métadonnées calculées | M |
| EF-09 | contrat de missions de démonstration : publier, accepter, clore | M |
| EF-10 | page publique de consultation | M |
| EF-11 | indemniser le client sur signalement grave | V1 |
| EF-12 | coefficient de bonus-malus, caution exigée, statut sous-garanti, retrait de l'excédent | V1 |
| EF-13 | délégations avec échéance et révocation | V1 |
| EF-14 | recours tranché par l'émetteur, avertissements et suspension de plateforme | V1 |
| EF-15 | stage de récupération | V1 |
| EF-16 | simulation de la profession par robots | V1 |
| EF-17 | jury tiré au sort, crédibilité des clients | MAX |
| EF-18 | prescription, barème versionné, récupération de compte | MAX |
| EF-19 | attestation inter-chaînes, preuve d'unicité, image produite par le contrat | MAX |

## 10. Contrats

Deux contrats : `permis`, le registre, et `missions`, une plateforme de démonstration qui l'interroge.

**État de `permis`** : catégories (barème, version, émetteur, caution de base) ; permis par couple compte-catégorie ; casiers par empreinte ; plateformes (active, avertissements) ; missions déjà enregistrées ; délégations ; recours ; fonds de garantie ; crédits par compte.

**Champs d'un permis** : `token_id`, `holder`, `category`, `identity`, `points`, `cap`, `issued_at`, `last_report_at`, `reinstated_at`, `suspended_until`, `missions_ok`, `missions_flagged`, `streak_ok`, `last_stage_at`, `bond`, `reports` (anneau de 20).

| Méthode | Appelant | Effet |
|---|---|---|
| `create_category(id, rules, base_bond)` | émetteur | fixe le barème de la version 1 |
| `approve_platform(category, account)` | émetteur | agrée une plateforme |
| `issue(account, category, identity)` | émetteur, avec caution jointe | délivre un permis probatoire, qui hérite du casier de l'empreinte |
| `record_mission(actor, category, mission_id, outcome, client, evidence)` | plateforme agréée | met à jour les compteurs, applique la perte de points, suspend à zéro, indemnise (V1) |
| `top_up_bond(category)` | titulaire, avec montant joint | complète la caution (V1) |
| `withdraw_bond_excess(category)` | titulaire | retire ce qui dépasse la caution exigée (V1) |
| `delegate(category, delegate, expires_at)` | titulaire | ouvre une délégation (V1) |
| `revoke_delegate(category, delegate)` | titulaire | la ferme (V1) |
| `contest(category, mission_id)` | titulaire, avec dépôt joint | ouvre un recours dans le délai (V1) |
| `resolve_contest(category, mission_id, upheld)` | émetteur | confirme ou annule (V1) |
| `claim_stage(category)` | titulaire | ajoute 4 points si les conditions sont réunies (V1) |
| `renounce(category)` | titulaire | rend le permis |
| `revoke(account, category, reason)` | émetteur | révoque pour fraude |
| `withdraw()` | tous | retire son crédit (indemnité, caution rendue) |
| `nft_transfer`, `nft_transfer_call` | personne | refus `ERR_SOULBOUND` |

**Vues** : `status(account, category)`, `is_allowed(account, category, min_points)`, `check(account, category, requirements)`, `license(token_id)`, `platform(account)`, `delegation(delegate, category)`, `fund()`, `rules(category, version)`, plus les vues NEP-171 et NEP-181.

**Contrat `missions`** : `post(reward)` ; `accept(mission_id)`, qui interroge `is_allowed` et attribue la mission dans le callback ; `close(mission_id, outcome)`, qui paie le prestataire puis appelle `record_mission`.

**Événements** (NEP-297) : `license_issued`, `mission_recorded`, `points_changed`, `license_suspended`, `license_reinstated`, `bond_slashed`, `client_compensated`, `contest_opened`, `contest_resolved`, `platform_struck`, `delegation_changed`.

**Invariants** :

| N° | Invariant |
|---|---|
| I1 | 0 ≤ points ≤ plafond ≤ capital maximal |
| I2 | cautions + fonds de garantie + crédits = versements − retraits |
| I3 | au plus un permis vivant par empreinte et par catégorie |
| I4 | une mission ne s'enregistre qu'une fois par plateforme |
| I5 | aucun appel ne change le titulaire d'un permis, hors récupération |
| I6 | une délégation ne survit ni à son échéance, ni à la suspension du titulaire |
| I7 | un barème publié ne change plus |

**Codes de refus** : `ERR_SOULBOUND`, `ERR_NOT_ISSUER`, `ERR_NOT_PLATFORM`, `ERR_PLATFORM_SUSPENDED`, `ERR_MISSION_ALREADY_RECORDED`, `ERR_NO_LICENSE`, `ERR_LICENSE_SUSPENDED`, `ERR_IDENTITY_SUSPENDED`, `ERR_IDENTITY_ALREADY_LICENSED`, `ERR_UNDER_BONDED`, `ERR_DELEGATION_EXPIRED`, `ERR_CONTEST_WINDOW_CLOSED`, `ERR_STAGE_NOT_ELIGIBLE`.

Standard : interface de lecture NEP-171 pour rester visible dans les wallets ; révocation et récupération inspirées de NEP-393, la spécification NEAR des jetons non transférables mise en œuvre par le registre I-Am-Human.

## 11. Écrans

| Écran | Contenu |
|---|---|
| Consultation publique | saisir un compte : permis, jauge de points, statut, ancienneté, coefficient, prochaine régénération |
| Mon permis | caution versée et exigée, excédent retirable, signalements, bouton de recours, délégations |
| Tableau des missions | publier, accepter, clore avec une note ; refus affiché avec son code |
| Console de l'émetteur | délivrer, agréer, trancher un recours |
| Fonds de garantie | solde, entrées et sorties |

## 12. Triche et sécurité

Rien ne change de main : le permis ne se transfère pas. La seule voie de déplacement est la récupération, lente et opposable.

| Attaque ou cas limite | Parade |
|---|---|
| compte recréé après une suspension | empreinte d'identité, casier hérité, caution renchérie, probation |
| vente du compte lui-même (clé privée cédée) | limite assumée, indétectable on-chain ; le casier reste lié à l'identité vérifiée, la caution reste en jeu, l'émetteur peut révoquer |
| plateforme qui signale abusivement | perte plafonnée par mission, recours, avertissements, suspension automatique de l'agrément |
| client maître-chanteur | signalement uniquement sur une mission close, une fois, par la plateforme ; recours ; dépôt exigé des clients souvent désavoués |
| missions fictives pour obtenir un stage | un stage par année ; plateformes agréées et responsables de leurs enregistrements |
| délégué qui continue après révocation | la délégation est vérifiée à chaque appel de `is_allowed` |
| titulaire qui retire sa caution avant un signalement | le retrait ne dépasse jamais l'excédent sur la caution exigée ; délai de réclamation à la renonciation |
| émetteur arbitraire | barème immuable par version, toute action de l'émetteur émet un événement public |
| récupération frauduleuse d'un permis | délai et droit d'opposition de l'ancien compte |
| double enregistrement d'une mission | identifiant de mission unique par plateforme |
| lecture périmée par un contrat tiers | `is_allowed` calcule le statut à l'instant de l'appel |
| fuite de données personnelles | motifs = codes de barème, pièces = hachés, identité = empreinte salée dont le sel reste hors chaîne |

## 13. Démo

Il n'y a pas de public : tout se prouve par script, par une page ouverte et par une vidéo.

**`make demo`** — bac à sable local, aucun secret, moins de deux minutes, 1 « mois » = 10 secondes.

| Étape | Fait | Vu |
|---|---|---|
| 1 | créer `coursier`, agréer `missions`, délivrer un permis à Léa (caution 1 NEAR) | 6 points, probatoire |
| 2 | Léa accepte une mission, close sans signalement | mission payée, `missions_ok` = 1 |
| 3 | mission close avec un signalement moyen | 3 points |
| 4 | avancer de 60 secondes | 4 points : régénération |
| 5 | mission close avec un signalement grave | 0 point, suspension de 60 secondes, fonds de garantie +0,20 NEAR |
| 6 | Léa tente d'accepter une mission | refus `ERR_LICENSE_SUSPENDED` |
| 7 | l'émetteur tente de délivrer un permis à `lea2` avec la même empreinte | refus `ERR_IDENTITY_SUSPENDED` |
| 8 | avancer de 60 secondes | probatoire à 6 points, `invalidations` = 1, mission acceptée |
| 9 | Léa tente `nft_transfer` | refus `ERR_SOULBOUND` |

Avec le niveau V1, l'étape 5 crédite en plus 0,20 NEAR au client et porte le coefficient à 1,25 ; à l'étape 8, le permis est sous-garanti jusqu'à ce que Léa complète sa caution.

**`make attack`** — chaque tentative doit échouer avec le code attendu.

| Tentative | Refus attendu |
|---|---|
| un compte non agréé enregistre une mission | `ERR_NOT_PLATFORM` |
| la même mission est enregistrée deux fois | `ERR_MISSION_ALREADY_RECORDED` |
| un second permis est demandé pour une empreinte déjà titulaire | `ERR_IDENTITY_ALREADY_LICENSED` |
| le titulaire transfère son permis | `ERR_SOULBOUND` |
| le titulaire retire sa caution sous le montant exigé (V1) | `ERR_UNDER_BONDED` |
| un délégué révoqué accepte une mission (V1) | `ERR_DELEGATION_EXPIRED` |
| une plateforme suspendue enregistre une mission (V1) | `ERR_PLATFORM_SUSPENDED` |

**`make sim`** (V1) — la profession de la section 7.16.

**`make demo-testnet`** — la même boucle sur les contrats déployés, avec les liens de l'explorateur.

**Page hébergée** — le tableau des missions vit sur testnet : des robots publient, acceptent et notent en continu ; un visiteur consulte n'importe quel permis et voit les points bouger.

**Vidéo du post X** (60 à 90 secondes) — un seul moment complet : un coursier est refusé en direct après un signalement grave, le client voit son indemnité arriver, et une minute plus tard le coursier est de nouveau accepté, en probation. Question finale : « de quel métier voudriez-vous voir le permis ? »

## 14. Planning

| Jour | Objectif | Porte de sortie |
|---|---|---|
| mardi 10, soir | dépôt neuf et public, licence, squelette des deux contrats | les deux contrats compilent |
| mercredi 11 | `permis` niveau M : barème, calcul paresseux, suspension, empreinte ; tests unitaires à horloge simulée | table de cas du barème verte |
| jeudi 12 | `missions`, appels entre contrats ; `make demo`, `make attack` ; déploiement testnet ; page de consultation | `make demo` vert de bout en bout |
| vendredi 13 | V1 dans cet ordre : `make sim`, indemnisation, bonus-malus, délégations, recours ; README ; hébergement | page en ligne ; gel des fonctionnalités le soir |
| samedi 14 | README rejoué sur machine vierge, vidéo, post X, formulaire | soumis avant 20:00 UTC |

Outils : Rust et `near-sdk` pour les contrats, `cargo near` pour la compilation, bac à sable local pour les tests, TypeScript et Vite pour la page. Dépôt distinct de `kiro-horror-tui`.

## 15. Modèle économique

| Qui | Paie | Reçoit |
|---|---|---|
| Titulaire | des frais d'émission, une caution qui lui reste acquise | une réputation transportable, une caution qui baisse avec le temps |
| Plateforme | un abonnement pour écrire dans le registre | des prestataires déjà notés dès son lancement, un client indemnisé sans litige |
| Client | rien | une indemnité automatique en cas de faute grave |
| Émetteur | la vérification d'identité | les frais d'émission |
| Opérateur du registre | l'hébergement | une part des frais d'émission et des abonnements |

La lecture reste gratuite pour tout le monde : c'est elle qui donne sa valeur au permis. Ordre de grandeur, à titre d'illustration : 10 000 titulaires à 2 $ de frais annuels et 20 plateformes à 100 $ par mois font 44 000 $ par an, sans toucher aux cautions.

## 16. Questions du jury

| Question | Réponse |
|---|---|
| Un fraudeur recrée un compte, et alors ? | son casier est attaché à son identité vérifiée, pas à son compte : le nouveau permis hérite des invalidations et coûte plus cher en caution |
| Pourquoi un NFT s'il ne se transfère pas ? | le ticket demande des jetons qui portent des justificatifs et possèdent de l'argent : c'est exactement un permis avec caution. Le standard le rend visible dans tous les wallets, avec son état du jour |
| Pourquoi on-chain plutôt qu'une base de données ? | des plateformes concurrentes ne partageront jamais une base tenue par l'une d'elles. Ici les règles sont immuables, la caution est séquestrée, et personne ne possède les données |
| Qui est l'émetteur, pourquoi lui faire confiance ? | celui que la profession reconnaît. Son barème est public et figé, chacune de ses actions laisse un événement, et la version ultime le remplace par une DAO et une preuve d'unicité |
| Et la vie privée ? | aucune donnée personnelle on-chain : des codes, des hachés, une empreinte salée. Les fautes anciennes sont prescrites |
| Les plateformes ont-elles intérêt à jouer le jeu ? | elles héritent d'une réputation au lieu de démarrer à vide, et la caution paie leurs litiges |
| Quel rapport avec les agents IA ? | la délégation : un opérateur met sa caution en jeu pour ses agents, et une suspension arrête toute sa flotte |
| Que prouve la démo sans public ? | `make sim` : une profession de cinq robots sur deux ans simulés, où le fraudeur ne repart pas de zéro |

## 17. Critères d'acceptation

- [ ] Les points effectifs suivent le barème sur une table de cas : pertes cumulées, régénération, plafond probatoire, retour au plafond.
- [ ] À zéro point, `is_allowed` répond non jusqu'à la fin de la suspension, puis oui.
- [ ] Une même empreinte ne détient jamais deux permis vivants d'une même catégorie, et retrouve son casier.
- [ ] Un compte non agréé ne peut pas enregistrer de mission ; une mission ne s'enregistre qu'une fois.
- [ ] Tout transfert échoue ; `nft_token` affiche les points du jour.
- [ ] L'invariant de conservation tient après chaque étape de `make demo`.
- [ ] `make demo` et `make attack` passent sur une machine vierge, sans secret, en moins de deux minutes chacun.
- [ ] V1 : un signalement grave crédite le client ; un permis sous-garanti est refusé jusqu'au complément ; un délégué révoqué est refusé.
- [ ] V1 : `make sim` vérifie ses cinq résultats attendus.

## 18. Existant, limites, points à vérifier

**Existant.** NEAR a une spécification de jetons non transférables (NEP-393), utilisée par le registre I-Am-Human pour prouver qu'un compte correspond à une personne. Une recherche dans les README des dépôts publics du hackathon (API GitHub, 10 novembre, une centaine de dépôts pour ce ticket) a trouvé des voisins partiels : une autorité de publication logicielle dont le jeton détient une caution, un engagement personnel avec mise, une identité on-chain pour agents IA, un pass de jeu. Aucun n'a de barème à points, de régénération, ni de casier attaché à une identité.

**Limites assumées.**

- La valeur du permis repose sur le sérieux de l'émetteur : la vérification d'identité reste hors chaîne.
- Céder une clé privée contourne la non-transférabilité ; le projet rend ce contournement coûteux, pas impossible.
- Des données de réputation sont sensibles : un déploiement réel demande une analyse juridique.
- Le barème français sert de modèle de règles, pas de reconnaissance officielle.

**À vérifier avant de coder.**

| Point | Pourquoi |
|---|---|
| version courante de `near-sdk` | signatures des appels entre contrats et des callbacks |
| outil de bac à sable recommandé | `near-workspaces` est annoncé en dépréciation au profit de `near-api-rs` et `near-sandbox-rs` |
| affichage des métadonnées calculées dans les wallets testnet | le titre dynamique doit être lisible sans page dédiée |
| source d'aléa du contrat | tirage des jurés au niveau MAX |
| règles du hackathon | la page officielle peut changer jusqu'à la clôture |

**Sources**, consultées le 10 novembre 2026 :

- Règles : <https://nearhackathon.com/HACKATHON.md>
- Exemple du ticket 10 : <https://github.com/nearai/near-hackathon-prompt-examples>
- Registre I-Am-Human et NEP-393 : <https://github.com/near-ndc/i-am-human>
- État de l'outillage Rust : <https://docs.near.org/blog/2026-01-06-near-rust-devtools-2025>
