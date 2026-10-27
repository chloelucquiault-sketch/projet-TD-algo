# Séjours Sportifs & Hébergements en Dortoirs

Application web responsive permettant aux clubs, associations et sportifs d'organiser des séjours sportifs dans des complexes proposant des infrastructures, des dortoirs et une option de restauration.

Un séjour couvre plusieurs jours, avec un minimum de **deux nuits**. Le responsable du groupe choisit les sports, les dates, la taille et le type du groupe, les couchages et, éventuellement, une formule repas. Sa demande reste en attente jusqu'à son traitement par le gestionnaire.

## Fonctionnalités

- Catalogue public des complexes, filtrable par région, sport, période et capacité d'hébergement.
- Fiche détaillée des infrastructures sportives, dortoirs et formules repas.
- Parcours guidé de demande de séjour, utilisable sur mobile et ordinateur.
- Comptes clients, suivi des demandes et états explicites : en attente, confirmée ou annulée.
- Espace gestionnaire pour consulter et traiter les demandes, et ajouter les infrastructures, dortoirs et formules de restauration de son complexe.
- Espace administrateur pour créer des complexes, assigner des gestionnaires et publier les complexes configurés.
- Authentification par session PostgreSQL et autorisations vérifiées côté API.

## Règles actuelles

- La date d'arrivée doit être aujourd'hui ou ultérieure ; la date de départ doit laisser au moins deux nuits.
- Les infrastructures sportives sélectionnées sont réservées sur toute la période du séjour et ne peuvent pas être attribuées à deux séjours qui se chevauchent.
- Les couchages ont une capacité définie par dortoir. Les demandes en attente **et** confirmées bloquent les ressources jusqu'à annulation.
- La disponibilité est revérifiée côté serveur lors de la création de la demande. PostgreSQL et le verrouillage transactionnel du complexe protègent contre les demandes concurrentes.
- Une demande créée n'est pas automatiquement confirmée : seul le gestionnaire assigné peut la confirmer ou l'annuler.
- Les prix, paiements en ligne, règles de remboursement et conditions d'annulation ne sont pas implémentés. Aucun paiement n'est collecté.
- Les repas sont enregistrés comme une option associée au séjour ; les quantités, menus et capacités de restauration restent à définir.

## Rôles

- **Visiteur** : consulte le catalogue et les détails des complexes.
- **Client / responsable de club** : crée un compte, soumet des demandes et suit leur état.
- **Gestionnaire** : gère les ressources et les demandes de son complexe.
- **Administrateur** : crée les complexes, attribue les gestionnaires et contrôle les publications.

Les inscriptions publiques créent uniquement des comptes clients. Le premier administrateur est créé par une commande locale ; les comptes gestionnaires sont ensuite créés depuis l'espace d'administration.

## Stack technique

- **Frontend** : React, TypeScript, Vite et React Router.
- **Backend** : Node.js, TypeScript, Express et API REST.
- **Base de données** : PostgreSQL, avec migration SQL versionnée.
- **Dépendances** : npm workspaces.

## Démarrage local

Prérequis : Node.js **20 ou plus récent** avec npm, et Docker Desktop lancé (ou une instance PostgreSQL 17 accessible).

1. Créer la configuration locale et définir un secret de session :

   ```powershell
   Copy-Item .env.example .env
   ```

   Dans `.env`, remplace `SESSION_SECRET` par une valeur aléatoire d'au moins 32 caractères. Tu peux en générer une avec :

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Démarrer PostgreSQL avec Docker :

   ```powershell
   docker compose up -d postgres
   ```

   Les identifiants du conteneur local sont définis dans `docker-compose.yml`. Ils sont réservés au développement ; ne les utilise pas en production.

3. Installer les dépendances et préparer la base :

   ```powershell
   npm install
   npm run db:migrate
   ```

4. Créer le premier administrateur. Définis les valeurs dans le terminal courant, puis lance le script :

   ```powershell
   $env:ADMIN_EMAIL = "admin@exemple.fr"
   $env:ADMIN_PASSWORD = "un-mot-de-passe-long-et-unique"
   $env:ADMIN_FULL_NAME = "Administrateur"
   npm run admin:create
   Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_FULL_NAME
   ```

5. Lancer l'API et le frontend :

   ```powershell
   npm run dev
   ```

   Ouvre ensuite [http://localhost:5173](http://localhost:5173). L'API écoute sur `http://localhost:3001`.

Dans l'espace administrateur, crée un complexe en brouillon puis un compte gestionnaire. Le gestionnaire peut ensuite y ajouter au moins une infrastructure et un dortoir. L'administrateur peut alors publier le complexe ; il apparaîtra dans le catalogue public. Les données du catalogue sont administrées dans l'application, sans comptes ou réservations de démonstration préchargés.

## Configuration

Les variables sont documentées dans `.env.example` :

- `DATABASE_URL` : chaîne de connexion PostgreSQL.
- `SESSION_SECRET` : secret de session d'au moins 32 caractères.
- `API_PORT` : port Express (par défaut `3001`).
- `WEB_ORIGIN` : origine web autorisée à envoyer des requêtes de modification (par défaut `http://localhost:5173`).
- `COOKIE_SECURE` : force l'attribut `Secure` des cookies lorsque nécessaire.

En production, configure `NODE_ENV=production`, un secret robuste, HTTPS avec cookies sécurisés, une base PostgreSQL dédiée et un proxy qui expose l'API et le frontend sous la même origine.

## Tests et build

```powershell
npm test
npm run build
```

Les tests unitaires vérifient les dates, les durées minimales, les comptes et la cohérence des couchages. Un test d'intégration PostgreSQL vérifie que deux demandes concurrentes ne peuvent pas réserver le même équipement :

1. Crée une base de test **distincte** de la base de développement :

   ```powershell
   docker compose exec -T postgres createdb -U sejours sejours_test
   ```

2. Configure les deux variables pour appliquer les migrations à cette base, puis exécute les tests :

   ```powershell
   $env:TEST_DATABASE_URL = "postgres://sejours:sejours@localhost:5432/sejours_test"
   $env:DATABASE_URL = $env:TEST_DATABASE_URL
   npm run db:migrate
   npm test
   Remove-Item Env:TEST_DATABASE_URL, Env:DATABASE_URL
   ```

Le test d'intégration est ignoré si `TEST_DATABASE_URL` n'est pas défini. Ne pointe jamais cette variable vers une base contenant des données à conserver : le test crée puis supprime ses propres enregistrements.

## API

Les principales routes et leurs permissions sont décrites dans [docs/API.md](./docs/API.md). L'API documente également son endpoint de santé `GET /health`.
