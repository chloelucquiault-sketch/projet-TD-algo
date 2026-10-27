# API REST

Base locale : `http://localhost:3001`. Les réponses d'erreur utilisent la forme `{ "error": { "code": "...", "message": "..." } }`. Les sessions sont conservées dans PostgreSQL et transmises par cookie HTTP-only `sid`.

## Santé, catalogue et disponibilité

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/health` | Public | État de l'API et connexion à PostgreSQL |
| `GET` | `/api/sports` | Public | Liste des sports |
| `GET` | `/api/complexes` | Public | Catalogue ; filtres facultatifs `region`, `sport`, `capacity`, `checkIn`, `checkOut` |
| `GET` | `/api/complexes/:id` | Public | Détails d'un complexe, infrastructures, dortoirs et repas |
| `GET` | `/api/complexes/:id/availability` | Public | Vérifie `checkIn`, `checkOut`, `groupSize` et `facilityIds` (liste d'UUID séparés par des virgules) |

Une disponibilité retournée par cette route est indicative : elle est toujours revérifiée dans la transaction de création de réservation.

## Authentification et réservations client

| Méthode | Route | Accès | Description |
|---|---|---|---|
| `GET` | `/api/auth/me` | Public | Compte de la session, ou `null` |
| `POST` | `/api/auth/register` | Public | Crée uniquement un compte client |
| `POST` | `/api/auth/login` | Public | Ouvre une session |
| `POST` | `/api/auth/logout` | Session | Ferme la session |
| `POST` | `/api/bookings` | Client | Crée une demande en attente après vérification atomique des ressources |
| `GET` | `/api/bookings/mine` | Client | Liste les demandes du client connecté |

Exemple de corps pour créer une demande :

```json
{
  "complexId": "UUID",
  "checkIn": "2030-06-10",
  "checkOut": "2030-06-13",
  "groupSize": 12,
  "groupType": "Association",
  "facilityIds": ["UUID"],
  "dormitories": [{ "dormitoryId": "UUID", "bedsReserved": 12 }],
  "mealOptionId": null
}
```

## Gestionnaire

Le gestionnaire ne peut accéder qu'aux complexes qui lui sont assignés.

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/manager/complexes` | Complexes assignés |
| `GET` | `/api/manager/bookings` | Demandes liées aux complexes accessibles |
| `PATCH` | `/api/manager/bookings/:id` | Confirmer ou annuler une demande en attente |
| `POST` | `/api/manager/complexes/:complexId/facilities` | Ajouter une infrastructure |
| `PATCH` | `/api/manager/facilities/:id` | Modifier ou désactiver une infrastructure |
| `POST` | `/api/manager/complexes/:complexId/dormitories` | Ajouter un dortoir |
| `PATCH` | `/api/manager/dormitories/:id` | Modifier ou désactiver un dortoir |
| `POST` | `/api/manager/complexes/:complexId/meals` | Ajouter une option repas |
| `PATCH` | `/api/manager/meals/:id` | Modifier ou désactiver une option repas |

Pour traiter une demande, le corps de `PATCH /api/manager/bookings/:id` contient `{"status":"confirmed"}` ou `{"status":"cancelled"}` ; `managerNote` est facultatif.

## Administration

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/api/admin/users` | Liste des comptes et complexes assignés |
| `POST` | `/api/admin/complexes` | Crée un complexe, en brouillon par défaut |
| `PATCH` | `/api/admin/complexes/:id` | Modifie un complexe ; sa publication exige un gestionnaire, une infrastructure et un dortoir |
| `POST` | `/api/admin/managers` | Crée un compte gestionnaire et l'assigne à un complexe non assigné |

Le compte administrateur initial est créé avec `npm run admin:create` à partir de variables `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `ADMIN_FULL_NAME`.
