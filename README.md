# Séjours Sportifs & Hébergements en Dortoirs

Application web permettant aux clubs, associations et sportifs de réserver des séjours sportifs tout compris (terrains de sport + hébergement en dortoirs + option repas) pour une durée de plusieurs jours (minimum 2 nuits).

## Objectifs

- Présenter les complexes sportifs, leurs dortoirs et les options de restauration.
- Permettre la réservation de séjours en groupe (minimum 2 nuits sur place).
- Gérer un calendrier de réservation par blocs de plusieurs jours ou semaines.
- Offrir aux gestionnaires un outil simple pour administrer leurs plannings, leurs infrastructures et la restauration.

## Utilisateurs et rôles

- **Visiteur** : consulte les séjours, les équipements et les options de restauration disponibles.
- **Client / Responsable de club** : crée un compte, réserve un séjour complet et suit son dossier.
- **Gestionnaire** : gère les équipements, les dortoirs, la restauration et valide les demandes de séjour.
- **Administrateur** : gère la plateforme et les utilisateurs.

## Fonctionnalités principales

### Recherche et consultation

- Consulter les complexes proposant des terrains, des dortoirs et des services de restauration.
- Filtrer par type de sport et capacité d'accueil des dortoirs.
- Afficher les détails des infrastructures sportives et des couchages en dortoir.

### Tunnel de réservation

Le parcours de réservation s'effectue étape par étape :

1. **Choix du sport** : sélection d'une ou plusieurs options sportives souhaitées pendant le séjour.
2. **Choix des dates** : sélection de la période (minimum 2 nuits), vérification des disponibilités en temps réel pour chaque sport choisi.
3. **Détails du groupe** : indication du nombre de personnes et de la nature du groupe (association, club professionnel, etc.).
4. **Options et récapitulatif** : ajout de l'option repas, choix des dortoirs et validation du récapitulatif global.

### Suivi et gestion

- Suivre l'état de la réservation (en attente, confirmée, annulée).
- Côté gestionnaire : ajouter ou modifier les équipements et les dortoirs, gérer les plannings et suivre les besoins en restauration.

## Stack technique

- **Frontend** : React
- **Backend** : Node.js avec Express
- **Base de données** : PostgreSQL
