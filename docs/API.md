# API REST — Alpes Camp

Base locale : `http://localhost:3001`. Les erreurs suivent la forme `{ "error": { "code": "...", "message": "..." } }`. Les sessions utilisent un cookie HTTP-only `sid` stocké dans PostgreSQL ; le navigateur n'a pas de jeton à gérer.

## Catalogue public

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | État de PostgreSQL et disponibilité du schéma d'authentification et des inscriptions |
| `GET` | `/api/camp-sessions` | Public | Départs ouverts dont la date de début n'est pas passée, avec jauge et places restantes |

Une session expose `season` (`summer` ou `winter`), `ageGroup` (`little`, `middle`, `teen`, `adult`), `startDate`, `endDate`, `durationDays`, `activities`, `capacity`, `reservedPlaces` et `remainingPlaces`. Les activités sont saisies par l'organisateur. Le catalogue n'expose aucune donnée de participant. Le séjour entier doit respecter les dates inclusives : été du 10 mai au 30 septembre, hiver du 15 décembre au 31 mars (sur un même cycle d'hiver). Le 30 septembre est la limite d'été, car le 31 septembre n'existe pas. Ces fenêtres sont vérifiées par l'API et par une contrainte PostgreSQL.

La réponse de `/api/health` inclut les contrôles `users`, `sessionStore`, `campSessions` et `campEnrollments`. Elle renvoie `503` si PostgreSQL est accessible mais que le schéma nécessaire au tunnel n'est pas prêt.

## Authentification

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/auth/me` | Public | Compte de la session ou `null` |
| `POST` | `/api/auth/register` | Public | Crée un compte client et ouvre sa session |
| `POST` | `/api/auth/login` | Public | Vérifie les identifiants et ouvre une session |
| `POST` | `/api/auth/logout` | Session | Ferme la session |

Les rôles sont `customer` et `admin`. L'inscription publique ne permet pas de choisir le rôle administrateur.

## Inscription et suivi client

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `POST` | `/api/camp-sessions/:id/enrollments` | Client | Inscrit de 1 à 20 participants à un départ publié |
| `GET` | `/api/camp-enrollments/mine` | Client | Retourne uniquement les inscriptions du client connecté |

Exemple de demande :

```json
{
  "healthDataConsent": true,
  "participants": [
    {
      "firstName": "Lou",
      "lastName": "Martin",
      "birthDate": "2020-06-01",
      "dietaryRestrictions": "Allergie aux noix",
      "medicalInstructions": "Consigne utile à l'encadrement",
      "specialRequests": "Son frère participe aussi"
    }
  ]
}
```

Le consentement doit être `true` et son horodatage/version sont enregistrés. En mode normal, les champs alimentaires, médicaux et les demandes particulières sont chiffrés AES-256-GCM avant insertion. En `DEMO_MODE=true`, ils ne sont pas chiffrés : ne saisir que des données fictives. Seul le client propriétaire et l'administrateur peuvent les consulter via leurs routes authentifiées.

Ces données privées sont conservées jusqu'à la date de fin du séjour incluse. Après cette date, l'API ne les renvoie plus et les efface de la base au démarrage puis toutes les 15 minutes. L'effacement du champ privé retire aussi les demandes particulières, car elles partagent ce champ ; l'identité, la date de naissance et l'historique de l'inscription ne sont pas supprimés par ce traitement.

La demande est atomique : une transaction crée l'inscription et tous ses participants. Si le départ est fermé, si les places manquent ou si un participant est invalide, aucune inscription partielle n'est conservée. Les inscriptions `pending` et `confirmed` consomment des places. L'insertion incrémente un compteur sous verrou PostgreSQL et un trigger refuse toute place au-delà de 20. L'annulation libère les places dans la même transaction que le changement d'état.

## Administration organisateur

Toutes les routes de ce tableau nécessitent le rôle `admin`.

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admin/camp-sessions` | Liste tous les départs configurés |
| `POST` | `/api/admin/camp-sessions` | Crée un départ ; la durée et la date de fin sont calculées selon le groupe |
| `PATCH` | `/api/admin/camp-sessions/:id` | Modifie le départ ou ouvre/ferme les inscriptions |
| `GET` | `/api/admin/camp-enrollments` | Liste les demandes et les informations privées des participants |
| `PATCH` | `/api/admin/camp-enrollments/:id` | Confirme ou annule une demande en attente |

Exemple de création d'un départ :

```json
{
  "season": "summer",
  "ageGroup": "little",
  "title": "Séjour d'été — Les Petits",
  "description": "Description réelle du départ.",
  "activities": "Activités réelles prévues pour ce départ.",
  "startDate": "2030-07-10",
  "registrationOpen": true
}
```

La durée est fixée côté serveur : 4 jours pour `little`, 7 jours pour les autres groupes. Les dates de début et de fin sont inclusives. La capacité est toujours 20, elle ne peut pas être modifiée par la requête.

Exemple de traitement :

```json
{ "status": "confirmed", "adminNote": "Inscription validée." }
```

Seules les demandes `pending` peuvent être traitées ; les statuts finaux sont `confirmed` ou `cancelled`. L'identifiant de l'administrateur et l'heure du traitement sont conservés. Une fois une inscription créée, la saison, les dates et le groupe du départ ne peuvent plus changer.

## Erreurs courantes

- `400 VALIDATION_ERROR` : champ absent, date invalide ou consentement manquant.
- `401 UNAUTHORIZED` : une session client est requise.
- `403 FORBIDDEN` : rôle insuffisant.
- `404 NOT_FOUND` : départ ou inscription introuvable.
- `409 REQUEST_ERROR` : inscription fermée, places insuffisantes ou état non modifiable.
- `500 INTERNAL_ERROR` : erreur serveur ; en mode démo, `error.diagnostic` donne un détail technique limité pour faciliter le diagnostic.

## Compatibilité avec l'ancienne version

Les tables et routes de réservation de complexes de la version précédente restent dans le dépôt pour préserver les migrations et données historiques. L'interface Alpes Camp ne les utilise pas ; les nouvelles inscriptions passent par les routes `/api/camp-*`.
