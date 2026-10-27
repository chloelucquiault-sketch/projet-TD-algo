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

## Calendrier des saisons

Les dates de saison sont inclusives. Un séjour entier, date de fin comprise, doit rester dans sa période :

- **Hiver** : du 15 décembre au 31 mars ; un séjour d'hiver peut traverser le changement d'année.
- **Été** : du 10 mai au 30 septembre.

Le 31 septembre n'existe pas : la fin de la saison d'été est donc fixée au **30 septembre**. L'API valide la période et PostgreSQL la protège également par une contrainte ; un départ qui dépasse la fenêtre est refusé.

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

Les informations médicales, restrictions alimentaires et demandes particulières chiffrées sont conservées jusqu'à la fin du séjour (date de fin incluse), puis effacées automatiquement par l'API au démarrage et toutes les 15 minutes. Après la date de fin, elles ne sont plus renvoyées par les routes, même avant l'effacement en base. Si l'API est arrêtée à ce moment-là, l'effacement est effectué à son prochain démarrage. Comme ces informations sont regroupées dans un seul champ chiffré, l'effacement retire également les demandes particulières qui y sont stockées. Les autres données d'inscription (identité, date de naissance, consentement et historique) ne sont pas supprimées par ce mécanisme et nécessitent une politique de conservation distincte.

La durée et l'effacement sont ainsi mis en œuvre techniquement ; les modalités de consentement du représentant légal et l'information des familles restent à définir avant une mise en production. La case de consentement et le chiffrement technique ne remplacent pas une validation juridique.

## Stack et organisation

- **Frontend** : React, TypeScript, Vite et React Router.
- **Backend** : Node.js, Express et TypeScript, API REST.
- **Base de données** : PostgreSQL avec migrations SQL versionnées.
- **Dépendances** : npm workspaces.
- `apps/web` contient l'application responsive.
- `apps/api` contient l'API, la couche de persistance et les migrations.
- `docs/API.md` décrit les routes principales.

La migration `004_alpine_camps.sql` ajoute les tables des départs, inscriptions et participants. La migration `006_camp_season_windows.sql` impose les périodes saisonnières au niveau PostgreSQL ; `007_camp_private_data_retention.sql` prépare l'effacement des informations privées après le séjour ; `008_remove_legacy_sports.sql` supprime les six sports de l'ancien projet et leurs associations aux terrains. Les anciennes tables de réservation restent en place, mais leurs données ne sont pas converties en inscriptions de colonie.

## Démarrage local (Windows / PowerShell)

Prérequis : Node.js **20 ou plus récent** avec npm, et Docker Desktop (ou PostgreSQL 17 accessible).

Vérifie que Node.js et npm sont accessibles depuis le terminal VS Code :

```powershell
node --version
npm.cmd --version
```

Si `npm` n'est pas reconnu alors que Node.js est installé dans son emplacement Windows habituel, ajoute son dossier au `PATH` du terminal courant, puis vérifie à nouveau :

```powershell
$env:Path += ";C:\Program Files\nodejs"
node --version
npm.cmd --version
```

Cette correction est temporaire pour le terminal courant. Pour la rendre permanente, ajoute `C:\Program Files\nodejs` à la variable utilisateur `Path` dans les paramètres d'environnement Windows, puis ferme et rouvre VS Code. Dans les étapes ci-dessous, `npm.cmd` évite également les blocages liés à la politique d'exécution de PowerShell.

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
   npm.cmd install
   npm.cmd run db:migrate
   ```

5. Créer le compte administrateur unique (à faire une seule fois ; l'inscription publique ne crée que des comptes clients). Remplace les exemples par ton adresse, ton nom et un mot de passe fort qui ne sera pas enregistré dans le dépôt :

   ```powershell
   $env:ADMIN_EMAIL = "organisateur@exemple.fr"
   $env:ADMIN_PASSWORD = "un-mot-de-passe-long-et-unique"
   $env:ADMIN_FULL_NAME = "Organisateur Alpes Camp"
   npm.cmd run admin:create
   Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_PASSWORD, Env:ADMIN_FULL_NAME
   ```

   Si PowerShell indique qu'un administrateur existe déjà, ne relance pas cette commande : utilise le compte existant. Après le démarrage du site, connecte-toi sur [http://localhost:5173/connexion](http://localhost:5173/connexion) avec ces identifiants ; le lien **Espace organisateur** apparaît dans la navigation.

6. Lancer l'API et le frontend :

   ```powershell
   npm.cmd run dev
   ```

   Ouvre [http://localhost:5173](http://localhost:5173). L'API est disponible sur `http://localhost:3001`. Connecte-toi avec le compte organisateur pour créer les premiers départs réels et ouvrir les inscriptions.

## Crédits des photos

Les photos du bandeau sont stockées localement dans `apps/web/public/images` et créditées dans le carrousel :

- Été alpin — Sternenjaeger, CC0 ([source](https://commons.wikimedia.org/wiki/File:Summer_morning_in_the_Swiss_Alps.jpg)).
- Alpes en hiver — Giles Laurent, CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Swiss_alps_seen_from_Creux_du_Van_under_the_winter_snow_Photo_by_Giles_Laurent.jpg)).
- Enfants en randonnée alpine — SWT666, CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Two_kids_resting_during_a_hike_on_the_Alps.jpg)).
- Enfants jouant au football dehors — Cecil Dzwowa, CC BY-SA 4.0 ([source](https://commons.wikimedia.org/wiki/File:Children_playing_football_in_street.jpg)).

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
npm.cmd test
npm.cmd run build
```

Les tests unitaires couvrent la validation des dates, durées et consentements ainsi que le chiffrement des champs privés. Les tests d'intégration PostgreSQL couvrent les rôles, les migrations et la jauge concurrente.

Pour les tests d'intégration, crée une base dédiée distincte de ta base de développement :

```powershell
docker compose exec -T postgres createdb -U sejours sejours_test
$env:TEST_DATABASE_URL = "postgresql://sejours:sejours@localhost:5432/sejours_test"
$env:DATABASE_URL = $env:TEST_DATABASE_URL
npm.cmd run db:migrate
npm.cmd test
Remove-Item Env:TEST_DATABASE_URL, Env:DATABASE_URL
```

Le test PostgreSQL est ignoré lorsque `TEST_DATABASE_URL` n'est pas défini. Ne pointe jamais cette variable vers une base contenant des données à conserver : les tests insèrent puis suppriment leurs données de test.

## API

Les routes de catalogue, d'inscription, d'authentification et d'administration sont documentées dans [docs/API.md](./docs/API.md). L'API documente également `GET /health`.
