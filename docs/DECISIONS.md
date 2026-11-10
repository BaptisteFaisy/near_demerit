# Décisions d'architecture (ADR) — Permis à points

Ce document consigne les choix structurants pris pour l'implémentation du permis à points sur NEAR Protocol.

---

### D1 — Barème en fonctions pures testables hors chaîne
- **Décision** : Le barème de calcul des points, des plafonds, des régénérations et des coefficients est isolé dans un module Rust autonome (`contracts/demerit/src/rules.rs`), exempt de tout appel à l'environnement de la machine virtuelle NEAR (`near_sdk::env`).
- **Justification** : Permet de tester exhaustivement la logique métier via `cargo test` standard en quelques millisecondes, sans déployer de sandbox ni instancier de runtime blockchain.
- **Conséquence** : Ce module pur est directement réutilisé par le binaire de simulation (`demo/bin/sim.rs`) et le scénario sandbox pour garantir une parité comportementale absolue.

---

### D2 — Calcul paresseux sans tâche de fond (cron/keeper)
- **Décision** : Les points régénérés, le plafond probatoire et l'expiration des suspensions sont évalués à la volée lors de chaque lecture (`is_allowed`, `status`) en comparant l'horodatage actuel aux jalons enregistrés, puis matérialisés lors de la prochaine écriture.
- **Justification** : Évite les coûts récurrents de gas et la dépendance envers des déclencheurs externes (crons off-chain ou keepers centralisés) incompatibles avec un registre décentralisé autonome.
- **Conséquence** : Les consultations de statut sont toujours à jour au nanoseconde près, et le titulaire ne paie du gas d'écriture que lorsqu'une mutation d'état a effectivement lieu.

---

### D3 — Empreinte salée calculée hors chaîne
- **Décision** : L'identité physique vérifiée est condensée en une empreinte hachée salée (`sha256(identity + salt)`) transmise au contrat lors de l'émission du permis ; le sel de l'émetteur ne transite jamais sur NEAR.
- **Justification** : Empêche l'exposition publique de données personnelles (conformité RGPD) tout en interdisant à un fraudeur d'échapper à son casier en recréant un compte NEAR vierge.
- **Conséquence** : L'émetteur reste garant de l'unicité du lien identité-empreinte, dans l'attente d'une preuve d'humanité sans divulgation de connaissance (roadmap niveau MAX).

---

### D4 — Caution en NEAR natif pour la démonstration
- **Décision** : Les cautions de garantie, indemnisations de clients et dépôts de recours sont gérés exclusivement en NEAR natif (`NearToken` / yoctoNEAR) plutôt qu'en jeton fongible NEP-141.
- **Justification** : Supprime les flux complexes de validation de transfert de jetons (`ft_transfer_call`), d'enregistrement de stockage NEP-145 et de gestion de soldes d'entiercement pour la démonstration du hackathon.
- **Conséquence** : Le modèle financier reste limpide, vérifiable via l'invariant de conservation I2, avec possibilité d'étendre ultérieurement le contrat aux devises stables (USDC/USDT).

---

### D5 — Mission unique par plateforme
- **Décision** : L'unicité d'une mission enregistrée s'appuie sur une clé composite associant l'identifiant de compte de la plateforme agréée et l'identifiant local de la mission (`format!("{}:{}", platform, mission_id)`).
- **Justification** : Permet à plusieurs plateformes concurrentes d'utiliser des numérotations indépendantes sans risque de collision ou de rejeu sur le registre commun.
- **Conséquence** : Aucun identifiant universel complexe n'a besoin d'être coordonné hors chaîne entre les plateformes partenaires.

---

### D6 — Coordonnées en points de base entiers (sans flottants)
- **Décision** : Le coefficient de bonus-malus et le partage du fonds de garantie sont encodés en points de base entiers (`BasisPoints = u16`, où `100` équivaut à un multiplicateur de 1,00).
- **Justification** : Les architectures WebAssembly pour smart contracts bannissent l'arithmétique en virgule flottante pour préserver le déterminisme absolu d'exécution entre nœuds validateurs.
- **Conséquence** : Toutes les opérations financières et d'ajustement de caution recourent à des multiplications suivies de divisions entières sécurisées contre les débordements (`saturating_mul`).

---

### D7 — Monoréférentiel unique pour les deux contrats
- **Décision** : Les contrats `demerit` (registre d'autorité) et `missions` (plateforme cliente de test), ainsi que le harnais de test sandbox, résident dans un unique espace de travail Cargo (`Cargo.lock` et workspace unifiés).
- **Justification** : Garantit la cohérence stricte des structures de données Borsh/Serde, des codes d'erreur et des définitions d'interfaces ABI entre l'émetteur et le consommateur.
- **Conséquence** : La compilation (`make build`), la vérification de conformité CI et les tests d'intégration sandbox s'exécutent d'un seul bloc sans déphasage de version.

---

### D8 — Absence d'aléa on-chain pour le tirage des jurés (niveau MAX différé)
- **Décision** : Le mécanisme de recours à jury de pairs tirés au sort parmi les titulaires méritants (niveau MAX) n'est pas intégré au livrable du hackathon, au profit d'un arbitrage direct par l'émetteur (niveau V1).
- **Justification** : L'implémentation sécurisée d'un tirage au sort vérifiable et résistant aux attaques par manipulation d'ordonnancement de transactions requiert un schéma de commit-reveal multipartite lourd hors budget temps.
- **Conséquence** : La feuille de route documente le schéma théorique de commit-reveal de vote sans encombrer la base de code déployée pour la compétition.
