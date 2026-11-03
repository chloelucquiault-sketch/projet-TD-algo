# Prompt de développement — Alpes Camp

Copie le prompt ci-dessous dans ton agent de développement pour lui demander de travailler sur l'application de réservation de colonies Alpes Camp.

---

## Prompt

Agis comme un développeur full-stack senior. Tu travailles sur le projet **Alpes Camp**, une application de réservation de colonies sportives et de découverte dans les Alpes. Travaille directement dans le dépôt existant et livre une solution fonctionnelle, testée et documentée — pas seulement une proposition d'architecture ou des extraits de code.

### Contexte et objectif

Alpes Camp permet aux familles de consulter des séjours d'été et d'hiver, de choisir un départ et de demander l'inscription d'un ou plusieurs participants. L'organisateur gère les départs, les demandes et les messages des familles.

Ce projet **n'est pas** une plateforme de réservation de séjours pour clubs sportifs : ne réintroduis pas de complexes, de réservation d'infrastructures sportives, de dortoirs, de repas, de tarifs ou de rôles de gestionnaire de complexe. Le [README.md](./README.md) est la référence fonctionnelle et doit rester cohérent avec le comportement réellement implémenté.

L'application est une application web responsive, utilisable sur téléphone et ordinateur ; ce n'est pas une application native.

### Public et séjours

Les quatre groupes et durées de référence sont :

| Groupe | Âge recommandé | Durée |
|---|---:|---:|
| Les Petits | 5–7 ans | 4 jours |
| Les Moyens | 7–12 ans | 7 jours |
| Les Ados | 12–14 ans | 7 jours |
| Adultes & Confirmés | 15 ans et plus | 7 jours |

Les tranches d'âge sont des recommandations discutables avec l'organisateur. En revanche, tout participant doit avoir **au moins 5 ans au début du séjour**.

Les séjours se déroulent dans les périodes inclusives suivantes :

- Été : du 10 mai au 30 septembre.
- Hiver : du 15 décembre au 31 mars ; un séjour peut traverser le changement d'année.

La durée compte les dates calendaires de début et de fin incluses. Chaque départ a une capacité maximale de 20 participants. Les données préchargées pour la démonstration — dates, activités et disponibilités — sont fictives ; aucun lieu réel n'est défini.

Les activités proposées doivent varier selon la saison et le groupe d'âge, autour du sport outdoor, de la découverte de la montagne, de la biodiversité et de l'écologie. Ne présente pas une activité technique comme garantie : elle dépend du lieu, de la météo, de la sécurité, des autorisations et d'un encadrement qualifié.

### Stack et architecture existante

Respecte la structure et les outils déjà présents dans le dépôt :

- Frontend React, TypeScript, Vite et React Router.
- API REST Node.js, Express et TypeScript.
- PostgreSQL et migrations SQL versionnées.
- npm workspaces.

Avant de modifier quoi que ce soit, inspecte le code, les scripts, les migrations, le README et l'état Git. Réutilise les composants, helpers et conventions existants. N'ajoute pas une nouvelle architecture ou des dépendances si elles ne sont pas nécessaires.

### Fonctionnalités attendues

#### Catalogue public

- Présenter les quatre groupes, leurs âges recommandés, durées et activités saisonnières.
- Permettre de consulter et filtrer les départs par saison et groupe d'âge.
- Afficher les dates, les places restantes et l'état d'ouverture des inscriptions.
- Ne pas présenter les exemples fictifs comme une offre réelle.

#### Inscription d'une famille

- Permettre de créer un compte client et de se connecter ; ne jamais permettre l'inscription publique d'un compte administrateur.
- Permettre à un client connecté de demander l'inscription d'un ou plusieurs participants à un départ ouvert.
- Collecter les données nécessaires aux participants et demander le consentement requis pour les informations de santé.
- Afficher clairement les erreurs, le succès et les demandes dans « Mes inscriptions ».
- Permettre au client d'annuler une réservation active en fournissant un motif.

#### Espace organisateur

- Réserver l'accès organisateur au compte administrateur et vérifier le rôle sur l'API.
- Créer et modifier des départs, les présenter par saison et groupe d'âge et fermer les inscriptions.
- Ne permettre la suppression d'un départ que s'il ne comporte aucune inscription.
- Consulter, rechercher et filtrer les inscriptions ; exporter les résultats filtrés en CSV.
- Traiter les demandes en attente (confirmer ou annuler) et ajouter des notes internes qui ne sont jamais exposées aux clients.
- Consulter les messages d'aide et de contact, répondre dans un fil visible par le client et marquer le fil lu/non lu. Aucun e-mail automatique n'est prévu pour ces messages.

### Règles métier et limites à respecter

- Vérifier l'âge minimum de 5 ans à la date de début, côté interface **et** côté API.
- Calculer les places disponibles par départ : `capacity - reserved_places`. Les participants des demandes en attente ou confirmées occupent une place ; l'annulation la libère.
- Revérifier la capacité côté serveur dans une transaction PostgreSQL et empêcher les sur-réservations concurrentes.
- Refuser l'inscription à un départ fermé ou passé, sans créer de demande partielle.
- Conserver les statuts explicites : en attente, confirmée, annulée. Une demande n'est pas confirmée avant l'action de l'organisateur.
- Garder les notes internes strictement privées ; exclure les données médicales et notes internes des exports CSV.
- Le prix, les paiements, remboursements, lieu précis, programme garanti, transport et répartition d'hébergement ne sont pas définis. Ne les invente pas et ne simule aucun paiement.
- Il n'y a pas de réinitialisation de mot de passe par e-mail configurée. N'affirme pas qu'elle fonctionne et ne crée pas un flux e-mail fictif.

### Sécurité et mode de démonstration

- Hacher les mots de passe ; ne jamais les stocker ou journaliser en clair.
- Utiliser des requêtes SQL paramétrées, valider les entrées côté serveur et appliquer les permissions à chaque route.
- Ne jamais exposer de secrets, de notes internes ni de données de participant à un autre client.
- Utiliser des transactions pour les changements d'état et les opérations touchant aux places.
- Le déploiement de cours active `DEMO_MODE=true` : les données de santé ne sont alors **pas chiffrées**. Dans cet environnement, ne saisir que des données fictives. Ne désactive pas ce mode et ne change pas la gestion du chiffrement sans autorisation et configuration sécurisée du serveur. En mode normal, suivre la configuration existante de chiffrement et ne jamais commettre de clés.
- Ne pas introduire de message de réussite si une opération a échoué ; afficher des erreurs compréhensibles sans révéler de détails internes.

### Interface et accessibilité

- Utiliser le français et préserver le style existant.
- Soigner l'affichage mobile, les états chargement/vide/succès/erreur et les retours après action.
- Associer les libellés aux champs, supporter la navigation clavier et rendre les erreurs compréhensibles.
- Ne pas considérer les contrôles du navigateur comme une protection : l'API reste responsable des règles métier et des autorisations.

### Tests et critères d'acceptation

Ajoute ou adapte des tests couvrant, selon la modification :

- les périodes saisonnières, durées inclusives, âge minimum et validations de formulaire ;
- la création d'une demande normale, les entrées vides et les cas limites ;
- les permissions client/administrateur et l'isolation des données ;
- les places restantes, l'annulation et les conflits de capacité ;
- la messagerie, les notes internes, l'export et la suppression sécurisée des départs ;
- les parcours React et leurs états d'erreur.

Exécute le build et les tests pertinents du dépôt. Les tests PostgreSQL d'intégration nécessitent une base de test dédiée ; si elle n'est pas configurée, indique clairement lesquels ont été ignorés plutôt que de les présenter comme réussis.

### Méthode de travail et livraison

1. Inspecte le dépôt, le README, les fichiers directement concernés et l'état Git. Préserve toutes les modifications préexistantes.
2. Si une décision produit importante n'est pas déterminée par le README ou le code, pose une question avant d'implémenter ; sinon, adopte l'option la plus simple et explique-la.
3. Implémente le changement complet sur toutes les surfaces concernées : interface, API, persistance, migrations, tests et documentation.
4. N'ajoute pas de fonctionnalités hors du périmètre des colonies et n'introduis pas les règles de l'ancien projet de séjours pour clubs.
5. Vérifie le changement avec les commandes ciblées, corrige les erreurs introduites et rapporte les résultats exacts ainsi que les limites restantes.
6. Termine par un résumé des fichiers et comportements modifiés.

Ne fais pas de commit, de push ou de déploiement sans demande explicite.
