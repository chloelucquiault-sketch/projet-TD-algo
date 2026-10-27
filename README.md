# Alpes Camp — Colonies de sport outdoor

Application web responsive de réservation de séjours sportifs d'été et d'hiver dans les Alpes. Les familles peuvent consulter les départs publiés, inscrire un ou plusieurs participants et suivre leur demande. L'organisateur configure les départs et traite les inscriptions depuis un espace privé.

## Séjours proposés

Les âges sont des repères, à discuter au cas par cas avec l'organisateur :

| Groupe | Âge recommandé | Durée |
|---|---:|---:|
| Les Petits | 5–7 ans | 4 jours |
| Les Moyens | 8–11 ans | 7 jours |
| Les Ados | 12–14 ans | 7 jours |
| Adultes & Confirmés | 15 ans et plus | 7 jours |

Chaque départ créé par l'organisateur est limité à **20 participants**. Aucune date, activité ou information de lieu n'est préchargée ou inventée : les départs ne deviennent visibles que lorsqu'ils sont configurés et publiés.

## Fonctionnalités

- Catalogue public des départs d'été et d'hiver, filtrable par saison et groupe d'âge.
- Jauge publique actualisée toutes les 15 secondes ; la disponibilité est toujours revérifiée au moment de l'inscription.
- Inscription réservée aux comptes connectés, avec un formulaire permettant d'inscrire une fratrie.
- Informations de naissance et consignes pratiques ; les informations de santé et les notes privées sont chiffrées en base.
- Demandes avec états explicites **en attente**, **confirmée** ou **annulée**. Une demande en attente bloque les places jusqu'à son traitement.
- Espace client pour consulter uniquement ses propres inscriptions et leurs détails.
- Espace organisateur protégé pour créer et publier les départs, voir les inscriptions et les confirmer ou annuler.
- Vérification de la jauge côté serveur et compteur PostgreSQL protégé contre les inscriptions concurrentes.
- Authentification par session PostgreSQL et cookie HTTP-only. L'inscription publique crée uniquement des comptes clients ; l'organisateur est créé par une commande locale.

## Règles et conventions

- Une durée de **4 jours** signifie quatre dates calendaires, date de début et date de fin incluses ; une durée de **7 jours** suit la même convention. La date de fin est calculée automatiquement à partir de la date de début et du groupe.
- La jauge de 20 est fixe par départ. Les participants de demandes **en attente et confirmées** sont comptabilisés ; l'annulation d'une demande libère ses places.
- Les âges affichés sont des recommandations. Une inscription hors tranche est possible et signalée à l'organisateur pour discussion ; le système ne décide pas d'une dérogation.
- Les activités et descriptions sont saisies par l'organisateur pour chaque départ ; aucun programme fictif n'est prérempli.
- Le calendrier, le lieu précis, les activités, les prix, les paiements, les annulations côté famille, les remboursements et les règles de répartition ne sont pas inventés ou simulés.
- Aucun paiement n'est collecté.
- Les dates de départ et les descriptions doivent être saisies par l'organisateur. Un départ ne peut plus changer de dates, saison ou groupe après la création d'une inscription.

## Données de santé et confidentialité

Les consignes alimentaires, informations médicales et demandes particulières sont chiffrées avec AES-256-GCM avant leur enregistrement. La clé `HEALTH_DATA_ENCRYPTION_KEY` est distincte du secret de session, n'est jamais stockée dans la base et doit être sauvegardée de manière sécurisée : sans cette clé, les champs privés déjà enregistrés ne pourront plus être déchiffrés. Elle ne doit jamais être commise ni partagée.

Les données privées sont renvoyées uniquement au compte client propriétaire et à l'administrateur. Le catalogue public ne reçoit aucune donnée de participant. Le consentement explicite est enregistré avec son horodatage et sa version.

**Avant une mise en production, il faut définir et mettre en œuvre une durée de conservation, la procédure d'effacement, les modalités de consentement du représentant légal et l'information des familles.** La case de consentement et le chiffrement technique ne remplacent pas cette décision ni une validation juridique.

## Stack et organisation

- **Frontend** : React, TypeScript, Vite et React Router.
- **Backend** : Node.js, Express et TypeScript, API REST.
- **Base de données** : PostgreSQL avec migrations SQL versionnées.
- **Dépendances** : npm workspaces.
- `apps/web` contient l'application responsive.
- `apps/api` contient l'API, la couche de persistance et les migrations.
- `docs/API.md` décrit les routes principales.

La migration `004_alpine_camps.sql` ajoute les tables des départs, inscriptions et participants. Elle ne modifie ni ne supprime les anciennes tables et réservations des versions précédentes ; aucune conversion automatique de ces réservations en inscriptions de colonie n'est effectuée.

## Démarrage local (Windows / PowerShell)

Prérequis : Node.js **20 ou plus récent** avec npm, et Docker Desktop (ou PostgreSQL 17 accessible).

1. Copier la configuration locale :

   ```powershell
   Copy-Item .env.example .env
   ```

2. Dans `.env`, remplacer `SESSION_SECRET` par une chaîne aléatoire d'au moins 32 caractères et renseigner `HEALTH_DATA_ENCRYPTION_KEY` avec une clé hexadécimale de 64 caractères. Générer chaque valeur séparément :

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   Ne réutilise pas la même valeur pour les deux secrets. Garde la clé de chiffrement en lieu sûr et conserve-la pour pouvoir lire les données chiffrées.

3. Démarrer PostgreSQL local :

   ```powershell
   docker compose up -d postgres
   ```

4. Installer les dépendances et appliquer les migrations :

   ```powershell
   npm install
   npm run db:migrate
   ```

5. Créer le compte administrateur unique (les valeurs ne sont pas enregistrées dans le dépôt) :

   ```powershell
   $env:ADMIN_EMAIL = "organisateur@exemple.fr"
   $env:ADMIN_PASSWORD = "un-mot-de-passe-long-et-unique"
   $env:ADMIN_FULL_NAME = "Organisateur Alpes Camp"
   npm run admin:create
   Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_FULL_NAME
   ```

6. Lancer l'API et le frontend :

   ```powershell
   npm run dev
   ```

   Ouvre [http://localhost:5173](http://localhost:5173). L'API est disponible sur `http://localhost:3001`. Connecte-toi avec le compte organisateur pour créer les premiers départs réels et ouvrir les inscriptions.

## Configuration

Les variables sont documentées dans `.env.example` :

- `DATABASE_URL` : chaîne de connexion PostgreSQL.
- `SESSION_SECRET` : secret de session d'au moins 32 caractères.
- `HEALTH_DATA_ENCRYPTION_KEY` : clé AES-256 de 32 octets représentée par 64 caractères hexadécimaux.
- `API_PORT` : port Express (par défaut `3001`).
- `WEB_ORIGIN` : origine web autorisée pour les requêtes de modification (par défaut `http://localhost:5173`).
- `COOKIE_SECURE` : force l'attribut `Secure` des cookies lorsque nécessaire.

En production, configure HTTPS, des cookies sécurisés, des secrets gérés hors du dépôt, une base PostgreSQL dédiée, des sauvegardes chiffrées et une politique de conservation avant de recueillir des données personnelles.

## Tests et build

```powershell
npm test
npm run build
```

Les tests unitaires couvrent la validation des dates, durées et consentements ainsi que le chiffrement des champs privés. Les tests d'intégration PostgreSQL couvrent les rôles, les migrations et la jauge concurrente.

Pour les tests d'intégration, crée une base dédiée distincte de ta base de développement :

```powershell
docker compose exec -T postgres createdb -U sejours sejours_test
$env:TEST_DATABASE_URL = "postgresql://sejours:sejours@localhost:5432/sejours_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm run db:migrate
npm test
Remove-Item Env:TEST_DATABASE_URL, Env:DATABASE_URL
```

Le test PostgreSQL est ignoré lorsque `TEST_DATABASE_URL` n'est pas défini. Ne pointe jamais cette variable vers une base contenant des données à conserver : les tests insèrent puis suppriment leurs données de test.

## API

Les routes de catalogue, d'inscription, d'authentification et d'administration sont documentées dans [docs/API.md](./docs/API.md). L'API documente également `GET /health`.
