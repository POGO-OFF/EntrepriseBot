# Entreprise Bot

Bot Discord permettant aux membres de publier un panneau d'entreprise avec :

- un titre ;
- une description facultative ;
- une image ;
- un bouton rouge **Entreprise Fermée** ;
- suppression réservée au créateur, au rôle administrateur configuré ou aux administrateurs Discord.

## 1. Prérequis

Installe Node.js 20 ou une version supérieure.

## 2. Configuration

Duplique le fichier `.env.example` et renomme la copie en `.env`.

Remplis ensuite :

```env
TOKEN=
CLIENT_ID=
GUILD_ID=
PANEL_CHANNEL_ID=
ADMIN_ROLE_ID=
```

Active le mode développeur de Discord pour copier les identifiants du serveur, du salon et du rôle.

Ne partage jamais le token du bot.

## 3. Installation

Dans le dossier du bot :

```bash
npm install
npm run deploy
npm start
```

`npm run deploy` enregistre la commande slash sur le serveur configuré.

## 4. Utilisation

Dans Discord :

```text
/panneau image:ton-image.png
```

Un formulaire s'ouvre pour saisir le titre et la description.

Le bot publie ensuite le panneau dans le salon configuré avec le bouton rouge **Entreprise Fermée**.

## 5. Permissions du bot

Le bot doit avoir au minimum :

- Voir le salon ;
- Envoyer des messages ;
- Intégrer des liens ;
- Joindre des fichiers ;
- Utiliser les commandes d'application ;
- Gérer les messages n'est pas nécessaire pour supprimer ses propres messages.
