# Prompt de développement — Séjours sportifs & hébergements en dortoirs

Copie le prompt ci-dessous dans ton agent de développement pour lui demander de construire l'application.

---

## Prompt

Agis comme un développeur full-stack senior et construis une application web de réservation de séjours sportifs. Travaille directement dans le dépôt existant, en respectant ses conventions et en livrant une application exécutable, testée et documentée — pas seulement une proposition d'architecture ou des extraits de code.

### Contexte produit

Le projet permet aux clubs, associations et sportifs d'organiser des séjours sportifs tout compris dans des complexes proposant :

- des infrastructures pour un ou plusieurs sports ;
- un hébergement en dortoirs ;
- une option de restauration.

Un séjour dure au minimum **deux nuits** et se réserve sur plusieurs jours ou semaines. Le client choisit un ou plusieurs sports, ses dates, renseigne la taille et le type de son groupe, puis sélectionne les dortoirs et l'option repas. La demande est soumise au gestionnaire, qui peut la suivre et la valider. Les rôles sont visiteur, client/responsable de club, gestionnaire et administrateur.

Le README du dépôt est la référence produit : lis-le avant toute modification et garde-le cohérent avec le comportement réellement implémenté. La cible est une **application web responsive et mobile-first**, utilisable dans un navigateur sur téléphone ; ce n'est pas une application native React Native.

### Stack et qualité attendue

- Frontend : React et TypeScript.
- Backend : Node.js, Express et TypeScript, exposant une API REST documentée.
- Base de données : PostgreSQL, avec migrations versionnées.
- Structure : séparation claire du frontend et de l'API. Choisis une organisation simple adaptée au dépôt, documente les décisions et évite les abstractions prématurées.
- Fournis une configuration locale reproductible (scripts, variables d'environnement documentées, et environnement PostgreSQL de développement si approprié). Ne commets aucun secret.
- Utilise des dépendances maintenues et des versions compatibles ; respecte le gestionnaire de paquets déjà présent. Si aucun n'est configuré, choisis-en un et documente-le.
- Utilise une validation explicite des entrées, des erreurs API cohérentes et des types partagés ou clairement définis entre client et serveur.

### Fonctionnalités MVP

#### Catalogue public

- Afficher les complexes et leurs informations : région, sports, infrastructures, capacité des dortoirs et options de restauration.
- Filtrer au minimum par région, type de sport, période et capacité d'accueil.
- Présenter les disponibilités et les détails nécessaires avant de commencer une demande de réservation.

#### Parcours de réservation

Construis un parcours guidé et accessible :

1. Choix d'un ou plusieurs sports et des infrastructures souhaitées.
2. Choix des dates, avec une durée minimale de deux nuits et vérification des disponibilités côté serveur.
3. Saisie du nombre de personnes et du type de groupe (club, association ou autre).
4. Choix des dortoirs et de l'option repas, puis affichage d'un récapitulatif avant l'envoi.
5. Création d'une demande consultable par le client et par le gestionnaire, avec un état explicite : en attente, confirmée ou annulée.

Conserve les données saisies lors du passage d'une étape à l'autre et affiche clairement les erreurs de validation, les indisponibilités et la confirmation d'envoi.

#### Espaces authentifiés

- Permettre au client de créer un compte, de se connecter, de consulter ses demandes et d'en voir l'état.
- Permettre au gestionnaire autorisé de créer et modifier les informations des complexes, sports, infrastructures, dortoirs, disponibilités et options de restauration, ainsi que de traiter les demandes de séjour.
- Réserver les opérations d'administration de la plateforme au rôle administrateur.
- Vérifier les autorisations côté serveur pour chaque opération : masquer un bouton dans l'interface ne constitue pas un contrôle d'accès.

### Règles métier et points à ne pas inventer

- Appliquer la durée minimale de deux nuits et valider les dates côté serveur.
- La disponibilité ne doit jamais dépendre uniquement de l'interface. Le serveur et PostgreSQL doivent empêcher les sur-réservations et les conflits, y compris si plusieurs demandes arrivent simultanément.
- Traiter une demande de réservation comme un ensemble cohérent : si une ressource indispensable n'est plus disponible, ne créer ni réservation partielle ni fausse confirmation.
- Modéliser clairement les statuts et leurs transitions autorisées ; conserver qui a effectué une action et à quel moment lorsque c'est pertinent.
- Le README ne définit pas encore la tarification, la politique d'annulation, les remboursements, les paiements en ligne, les horaires précis des activités, ni les règles de répartition des couchages et des repas. N'invente pas ces règles et ne simule pas un paiement réel. Identifie les décisions bloquantes et demande une clarification avant d'implémenter un comportement qui les suppose. Si elles ne bloquent pas le socle, documente les hypothèses retenues et garde ces parties configurables.
- Ne suppose pas qu'une réservation est confirmée avant la validation du gestionnaire.

### Exigences de sécurité et de fiabilité

- Hasher les mots de passe avec un algorithme adapté ; ne jamais les stocker ni les journaliser en clair.
- Protéger les routes selon le rôle et les ressources détenues/gérées par l'utilisateur ; appliquer le principe du moindre privilège.
- Valider toutes les entrées côté serveur, utiliser des requêtes paramétrées et ne pas exposer de secrets ni de détails internes dans les réponses d'erreur.
- Configurer correctement les origines autorisées, les sessions ou jetons, les cookies le cas échéant, et les protections contre les abus selon le mécanisme d'authentification choisi.
- Utiliser des transactions PostgreSQL pour les opérations multi-ressources et les changements d'état sensibles.
- Fournir des messages d'erreur utiles sans transformer les échecs en succès apparents. Ne pas ignorer silencieusement les erreurs.

### Interface et accessibilité

- Concevoir une interface en français, responsive et mobile-first.
- Fournir des états de chargement, vide, succès et erreur pour les vues principales.
- Rendre les formulaires utilisables au clavier, associer les libellés aux champs et rendre les erreurs compréhensibles.
- Garder les étapes du parcours de réservation claires sur petit écran ; ne pas afficher de disponibilité comme garantie si elle n'a pas été vérifiée côté serveur.

### Tests et critères d'acceptation

Ajoute et exécute des tests adaptés au projet :

- tests unitaires des validations et règles métier, notamment les dates et la durée minimale ;
- tests d'intégration de l'API et de la persistance PostgreSQL ;
- tests des permissions : un client ne peut pas administrer un complexe, un gestionnaire ne peut pas administrer des ressources hors de son périmètre, et les opérations administrateur sont protégées ;
- tests de réservation concurrente ou, à défaut, tests démontrant que la transaction et les contraintes empêchent une sur-réservation ;
- tests du parcours principal côté interface et des états d'erreur essentiels.

Le MVP est acceptable lorsque :

1. l'application et PostgreSQL peuvent être démarrés à partir des instructions du dépôt ;
2. un visiteur peut consulter et filtrer les complexes ;
3. un client authentifié peut soumettre une demande valide d'au moins deux nuits et consulter son état ;
4. un gestionnaire autorisé peut gérer les informations de son complexe et traiter les demandes ;
5. les règles de rôle et les protections contre les conflits de disponibilité sont vérifiées par des tests ;
6. les commandes de test, de lint et de build disponibles passent, ou les blocages restants sont explicitement rapportés.

### Méthode de travail et livraison

1. Inspecte le dépôt, son README, ses scripts et son état Git avant de modifier quoi que ce soit. Préserve les changements existants.
2. Résume brièvement l'architecture proposée et liste les questions métier qui bloquent une décision structurante. Pose les questions avant de coder si une réponse est indispensable ; sinon, adopte des valeurs par défaut prudentes, annonce-les et documente-les.
3. Implémente le MVP par étapes cohérentes, sans remplacer une implémentation fonctionnelle par des maquettes ou des données fictives dans le chemin normal d'exécution.
4. Ajoute ou mets à jour les migrations, tests, exemples de configuration et documentation nécessaires.
5. Exécute les vérifications ciblées, corrige les problèmes introduits et rapporte précisément les commandes exécutées et leurs résultats.
6. Termine par un résumé des fichiers et fonctionnalités livrés, des hypothèses restantes et des étapes nécessaires pour lancer l'application.

Ne fais pas de commit et ne pousse pas vers GitHub sans demande explicite.
