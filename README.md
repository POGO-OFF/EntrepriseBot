# Bot Discord Command Center

Ce bot synchronise automatiquement ton serveur Discord avec la base Supabase du **Discord Command Center**.

## Ce qu’il fait

- ajoute automatiquement un membre lorsqu’il rejoint le serveur ;
- met à jour son pseudo, avatar, surnom et ses rôles ;
- conserve son profil avec le statut `left` lorsqu’il quitte le serveur ;
- synchronise les salons pour permettre leur sélection dans le créateur d’embed ;
- importe les membres déjà présents au démarrage ;
- fournit la commande administrateur `/sync` ;
- écrit les actions importantes dans `audit_logs`.

## Modération intégrée

Les commandes sont réservées aux membres possédant les permissions Discord correspondantes :

- `/warn` : ajouter un avertissement ;
- `/note` : ajouter une note interne, visible dans le Command Center ;
- `/timeout` et `/untimeout` : appliquer ou retirer un timeout ;
- `/kick` : expulser un membre ;
- `/ban` et `/unban` : bannir ou débannir ;
- `/sanctions` : consulter les dix dernières sanctions.

Chaque action alimente automatiquement les tables `sanctions` et `audit_logs`. Le rôle du bot doit être placé au-dessus des rôles qu’il doit modérer.

## Tickets et logs

1. Exécute `migrations/002_tickets_and_logs.sql` dans l’éditeur SQL Supabase.
2. Renseigne dans `.env` les identifiants de la catégorie des tickets, du rôle support et des salons de logs.
3. Active aussi **Message Content Intent** dans le portail développeur Discord.
4. Redémarre le bot puis utilise `/ticket-panel` dans le salon de ton choix.

Le panneau propose quatre motifs clairs : assistance générale, signalement d’un membre, faux profil/usurpation et entreprise/partenariat. Le joueur choisit un motif, puis un salon privé est créé avec un nom et un en-tête structurés. Le staff peut le prendre en charge et le fermer après confirmation. Jusqu’à 500 messages sont enregistrés dans la base et envoyés sous forme de transcription dans le salon de logs des tickets.

Les logs couvrent les messages supprimés ou modifiés, les arrivées et départs, les changements de rôles ou surnoms, les mouvements vocaux, les salons créés ou supprimés ainsi que les bannissements.

## Pack complet de modération

Exécute aussi `migrations/003_full_moderation.sql`. Cette migration active les fonctions suivantes :

### Actions depuis le Command Center

Le bot vérifie `bot_action_queue` toutes les cinq secondes. Le site peut y placer une action `warn`, `timeout`, `kick`, `ban`, `unban` ou `send_embed`. Le bot exécute l’action, puis enregistre le résultat ou l’erreur. Le token Discord et la clé serveur ne sont jamais exposés dans le navigateur.

Pour utiliser directement le site ChatGPT Sites, remplis aussi `SITE_BASE_URL` et `SITE_SYNC_SECRET`. La même valeur secrète doit être enregistrée dans la variable `DISCORD_SYNC_SECRET` du site. Les tickets, logs et sanctions seront alors recopiés dans le Command Center.

### Sanctions progressives

Par défaut : deux avertissements actifs provoquent un timeout de 60 minutes et quatre provoquent un bannissement. Les seuils se modifient dans `guild_moderation_config`. Les sanctions automatiques sont identifiées par la colonne `automatic`.

### Preuves

Les commandes `/warn`, `/note`, `/timeout`, `/kick` et `/ban` acceptent une pièce jointe et/ou un lien de preuve. Les URL sont conservées dans `sanctions.evidence_urls`.

### Protection automatique

- anti-spam avec timeout automatique ;
- blocage facultatif de tous les liens ;
- blocage des invitations Discord ;
- limite de mentions ;
- détection des comptes récents ;
- détection d’un afflux de comptes et mode anti-raid ;
- attribution facultative d’un rôle de quarantaine.

Tous les seuils de protection sont disponibles dans `.env.example`. Mets `ANTI_LINKS_ENABLED=true` seulement si tu souhaites interdire tous les liens.

## Ordre des migrations

1. `discord_admin_panel_schema.sql`
2. `migrations/002_tickets_and_logs.sql`
3. `migrations/003_full_moderation.sql`

## 1. Créer le bot Discord

1. Ouvre https://discord.com/developers/applications
2. Clique sur **New Application** puis donne-lui un nom.
3. Dans **Bot**, crée le bot et récupère son token.
4. Active **Server Members Intent** dans la partie *Privileged Gateway Intents*.
5. Dans **OAuth2 > URL Generator**, coche `bot` et `applications.commands`.
6. Donne-lui **View Channels**, **Send Messages**, **Moderate Members**, **Kick Members** et **Ban Members**, puis invite-le sur ton serveur.

Ne publie jamais le token Discord ni la clé `service_role`.

## 2. Préparer la base

Exécute d’abord le fichier SQL `discord_admin_panel_schema.sql` déjà fourni pour le Command Center dans l’éditeur SQL Supabase.

Dans Supabase :

- `SUPABASE_URL` se trouve dans **Project Settings > API** ;
- `SUPABASE_SERVICE_ROLE_KEY` est la clé serveur `service_role` du même projet.

## 3. Configuration

Duplique `.env.example` en `.env`, puis remplis :

```env
DISCORD_TOKEN=token_secret_du_bot
DISCORD_CLIENT_ID=id_de_l_application
DISCORD_GUILD_ID=id_du_serveur
SUPABASE_URL=https://ton-projet.supabase.co
SUPABASE_SERVICE_ROLE_KEY=cle_service_role
SYNC_ON_START=true
SYNC_CHANNELS=true
```

Pour copier l’identifiant du serveur, active le **mode développeur** dans Discord, fais un clic droit sur le serveur puis **Copier l’identifiant**.

## 4. Lancer sur ton ordinateur

Installe Node.js 20 ou plus récent, puis lance :

```bash
npm install
npm start
```

Le terminal doit rester ouvert. Pour que le bot fonctionne 24 h/24, héberge-le sur un service Node.js comme Railway, Render ou un VPS.

## Déploiement Docker

```bash
docker build -t discord-command-center-bot .
docker run --env-file .env discord-command-center-bot
```

## Sécurité

- Le bot utilise la clé `service_role`, qui contourne les règles RLS : garde-la uniquement côté serveur.
- N’ajoute jamais `.env` à GitHub.
- Si une clé est exposée, révoque-la immédiatement et génère-en une nouvelle.
