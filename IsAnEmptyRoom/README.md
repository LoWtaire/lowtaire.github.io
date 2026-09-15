# IsAnEmptyRoom

Site statique permettant de consulter les salles libres du campus Bridoux. L’emploi du temps ADE est converti en JSON par GitHub Actions, puis le site est publié sur GitHub Pages.

## Contenu

- `adeb/` : liste, recherche et disponibilité des salles ;
- `plan/` : plan interactif du campus Bridoux ;
- `data/univlor.json` : données générées à partir du calendrier ICS ;
- `.github/workflows/update-and-deploy.yml` : actualisation quotidienne et déploiement.

L’interface calcule l’état d’une salle directement dans le navigateur. Le workflow n’a donc pas besoin de tourner toutes les quelques minutes : les événements des 60 prochains jours sont déjà présents.

## Configuration GitHub

Le workflow utilise uniquement `ICS_URL_UNIVLOR`. Il accepte cette valeur comme Secret ou comme Variable GitHub. `ICS_URL` et `ICS_URLS_ULCO_DUNKERQUE` peuvent être supprimées.

L’URL peut conserver les paramètres `firstDate` et `lastDate` visibles lors de sa copie depuis ADE. Le générateur les remplace automatiquement à chaque exécution par une période glissante allant de la veille aux 60 prochains jours. Il ne faut donc pas modifier manuellement le lien chaque semaine.

Si `ICS_URL_UNIVLOR` est définie dans un Environment, celui-ci doit s’appeler `github-pages`, comme dans le workflow. Sinon, place la valeur au niveau du dépôt.

Dans **Settings → Pages → Build and deployment**, sélectionner **GitHub Actions** comme source. Lancer ensuite manuellement le workflow **Actualiser les salles et déployer** une première fois.

## Test local

Les modules et les chargements JSON nécessitent un serveur HTTP. Depuis la racine du projet :

    python3 -m http.server 8000

Puis ouvrir http://localhost:8000.

Pour contrôler les données existantes :

    node scripts/validate-data.mjs data/univlor.json
