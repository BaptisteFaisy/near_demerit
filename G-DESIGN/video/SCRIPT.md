# demerit — vidéos de démo (parcours utilisateur A→Z)

## Règles du hackathon (lues sur https://nearhackathon.com/HACKATHON.md, 2026-11-13)
- Le problème d'abord ; un moment complet : une vraie action de l'utilisateur jusqu'au résultat visible.
- Pas d'intro longue, pas de schéma d'architecture, pas d'installation.
- Dire concrètement ce que NEAR permet (pas « powered by NEAR »).
- Finir par une prochaine étape : liens dépôt + démo, une vraie question.
- Vidéo obligatoire (Q-012) ; post X « built at NEAR HACKATHON », @NEARProtocol, #NEARHackathon.
- Pas de durée imposée : limite X = 2 min 20.

## V1 — 2026-11-13 · deux vidéos, voix ElevenLabs (compte de Baptiste, secret `SCAN_ELEVENLABS_2`)

| Vidéo | Voix | Durée | Contenu |
|---|---|---|---|
| `demerit-demo-baptiste.mp4` | Baptiste `xcfbycT4BzrNSijbingw` | 1:03 | parcours A→Z sans intro (14 répliques) |
| `demerit-demo-gaia.mp4` | Gaia `hUgFhs9U5VcF4E65CSsv` | 2:18.6 | phrase d'ouverture limpide, parcours A→Z, 5 explications NEAR (23 répliques) |

Explications NEAR de la vidéo Gaia, chacune sous un angle différent :
comptes nommés et NFT visible dans tout wallet · appels entre contrats assez peu chers pour chaque mission ·
lectures gratuites, sans compte, recalculées à l'instant · le contrat déplace l'argent (caution → client + fonds) ·
sous-comptes et clés limitées pour un agent IA délégué.

Tournage : vrais clics dans la version jouable (`planches/v10`, moteur = portage 1:1 du contrat Rust,
vrais codes de refus), mise en page vidéo injectée (`layout.css`, aucun fichier du site modifié),
puis la page publique qui lit `lea.demerit.testnet` en direct (JSON-RPC, sans wallet), puis la carte de fin.

Pipeline : `video.py tts` (via `tools/with-secrets.ps1`, clé jamais affichée) → `capture.mjs <v>`
(Chrome + GPU, un plan = exactement sa réplique) → `video.py assemble` (1440×810 + bande de sous-titres 110 px).
Contrôles : durée (ffprobe), aucun silence > 2 s, −16,5 / −16,4 LUFS, planche contact relue plan par plan.

Points du site repérés pendant le tournage (code non modifié) :
- le terminal de la version jouable écrit « EVENT undefined » et « points_changed undefined → 6 » (masqué au tournage) ;
- la page publique affiche « Sous-Garanti » à côté d'une caution 0,17 > exigée 0,125.

## V2 — 2026-11-13 · une seule vidéo (remplace gaia + baptiste)

`demerit-demo.mp4` · **2:17** · voix Baptiste (`xcfbycT4BzrNSijbingw`) · anglais · site A V25 (noir + violet néon).
Script : `lines-final.json` (23 répliques, 300 mots). Lancement : `VIDEO=final`.

- Problème en deux plans, sans intro : « bad courier opens a new account, client never paid back » → « Demerit is a points licence… soulbound NFT on NEAR ».
- Parcours complet de Léa : licence → mission → faute moyenne → temps → faute grave + remboursement → refus → nouveau compte refusé → retour (caution +25 %, recharge) → licence invendable → agent IA → Sam retire → check live.
- Cinq encarts NEAR distincts : named accounts · contract calls · free reads · money in code · sub-accounts.
- Preuve live : `lea.demerit.testnet` lu en direct sur testnet (12/12 pts).
- Fin : liens démo + code, « Built at NEAR HACKATHON · @NEARProtocol · #NEARHackathon », question « Which job would you license first? ».

Contrôles : 137,1 s (< 2:20), aucun silence > 2 s, −16,6 LUFS, planche contact relue (23 plans).
Changelog V1 → V2 : 2 vidéos → 1 · FR → EN · site V24 → V25 · tournage sur la version jouable du site A (plus de layout injecté) · problème posé d'entrée · NEAR étiqueté 5 fois.
Les anciennes `demerit-demo-gaia.mp4` / `demerit-demo-baptiste.mp4` sont remplacées.
