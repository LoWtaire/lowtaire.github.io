# Campus · Emploi du temps ULCO

Une interface mobile first pour l’emploi du temps M2 EGEDD, alimentée par le lien d’abonnement iCalendar fourni. HTML, CSS et JavaScript natifs : aucune dépendance à installer pour le site, aucune clé API, aucun compte supplémentaire.

## Mise en ligne sur GitHub Pages

1. Décompresser cette archive.
2. Créer un dépôt GitHub (public pour GitHub Pages avec GitHub Free), avec une branche `main`.
3. Mettre **le contenu du dossier** à la racine du dépôt : `index.html`, `app.js`, `styles.css`, `favicon.svg`, `data/`, `scripts/`, `tests/` et **`.github/workflows/pages.yml`**. Ne pas téléverser le ZIP lui-même. Attention : le dossier `.github` peut être masqué par ton explorateur ; son workflow est indispensable.
4. Dans le dépôt : **Settings → Pages → Build and deployment → Source → GitHub Actions**.
5. Dans **Actions**, ouvrir **Publier et actualiser le planning**, puis **Run workflow** sur `main` (ou pousser un nouveau commit). Accepter l’activation d’Actions si GitHub la demande.
6. Une fois l’action verte, le lien du site se trouve dans **Settings → Pages** et dans le résultat du déploiement.

Tous les chemins sont relatifs : le site fonctionne aussi dans `https://pseudo.github.io/nom-du-depot/`.

## Comment l’abonnement est suivi

Source exacte : https://edt.univ-littoral.fr/jsp/custom/modules/plannings/m32a1PWk.shu

Ce lien renvoie du texte iCalendar, utilisable par un calendrier natif. Lors de la vérification, le serveur n’envoyait pas d’en-tête `Access-Control-Allow-Origin`. Un navigateur ne peut donc pas le lire directement depuis un site GitHub Pages.

Le workflow contourne cette contrainte de fonctionnement en récupérant le flux **côté GitHub**, puis en publiant `data/schedule.json` avec le site. Il se lance à chaque push sur `main`, manuellement, et environ toutes les heures à la minute 17 UTC. La programmation GitHub peut être retardée ; il ne s’agit pas d’une synchronisation instantanée. Aucun service proxy tiers n’est utilisé.

Le bouton ↻ du site recharge **la dernière version publiée**, il ne déclenche pas une récupération à l’université. Pour forcer cette récupération : **Actions → Publier et actualiser le planning → Run workflow**.

La date de dernière récupération figure au bas du planning. Un indicateur avertit si les données ont plus de six heures. Si l’université est indisponible ou renvoie des données invalides, l’action échoue et le site déjà publié garde ses données. La première mise en ligne nécessite donc une récupération réussie.

Sur les dépôts publics inactifs, GitHub désactive les workflows programmés après 60 jours sans activité. Les réactiver dans Actions si nécessaire. Vérifier les limites Actions de ton compte si tu utilises un dépôt privé.

Le ZIP inclut une vraie copie du flux récupérée le 3 novembre 2026, avec 74 événements, pour tester immédiatement. Les exécutions suivantes remplacent cette copie dans l’artefact publié, sans générer de commits horaires dans ton dépôt. L’export `.ics` correspond au calendrier complet publié ; pour un abonnement dans le téléphone, utiliser le lien ULCO original.

## Fonctionnalités

- Interface mobile first et navigation fixe sur téléphone ; disposition élargie sur ordinateur.
- Vues journée et semaine, choix d’une date, retour à aujourd’hui.
- Prochain cours, cours en cours, salles, descriptions et pauses.
- Recherche dans les cours à venir (matière, salle, enseignant).
- Filtre anglais : tous les groupes, groupe 1 G. Capelle ou groupe 2 M. Louvet.
- Thème clair/sombre et préférences enregistrées dans le navigateur.
- Export du calendrier complet au format iCalendar.
- Conservation locale du dernier calendrier chargé, utilisable si le rechargement des données échoue **dans une page déjà ouverte**. Ce n’est pas une PWA hors ligne et un premier chargement de la page nécessite Internet.
- Horaires affichés en Europe/Paris, même si l’appareil se trouve dans un autre fuseau.

Par défaut, les deux groupes d’anglais sont visibles, comme dans le flux. Choisir ton groupe dans Préférences pour éviter les doubles cours et obtenir le total d’heures correspondant. Les descriptions, salles et noms sont ceux de l’université. Une absence de cours signifie seulement une absence d’événement dans le flux chargé.

## Tester en local

Avec Python 3.11 ou plus récent, depuis le dossier :

```bash
python -m http.server 8000
```

Ouvrir http://localhost:8000. Ne pas ouvrir `index.html` par double clic : le navigateur bloquerait la lecture du JSON sous `file://`.

Pour récupérer le flux manuellement :

```bash
python scripts/sync_calendar.py
```

Pour exécuter les vérifications :

```bash
python -m unittest discover -s tests -v
node --check app.js
```

Python utilise uniquement la bibliothèque standard. Le parseur gère le format réellement observé : événements individuels, UTC, fuseaux IANA, lignes repliées, caractères échappés, annulations et journées entières. Si des récurrences RRULE/RDATE apparaissent, il refuse la mise à jour plutôt que d’afficher un planning incomplet. Il faudra alors ajouter un moteur de récurrence.

Les polices DM Sans et Manrope sont chargées depuis Google Fonts ; si elles sont indisponibles, le site utilise les polices du système. Aucun suivi d’audience n’est intégré.

## Modifier

- Design : `styles.css`.
- Interface : `index.html` et `app.js`.
- Source : constante `SOURCE` dans `scripts/sync_calendar.py`, puis mettre à jour les liens ULCO dans `index.html`.
- Fréquence : champ `schedule` dans `.github/workflows/pages.yml`.

Documentation officielle :
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
