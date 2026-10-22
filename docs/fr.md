# AirNow

## Présentation

[AirNow](https://www.airnow.gov) est le programme de qualité de l’air de l’Agence américaine de protection de l’environnement (EPA) et de plus de 150 agences d’États, locales et tribales. Il publie l’**indice de qualité de l’air (AQI)** mesuré chaque heure par plus de 2 500 stations, et les prévisions de plus de 500 villes, aux États-Unis, au Canada et au Mexique.

Cette intégration l’amène dans Gladys pour jusqu’à trois lieux, chacun une maison de Gladys ou un code ZIP : l’AQI actuel avec PM2,5, ozone et PM10, la prévision des prochains jours, des déclencheurs de scène quand la qualité de l’air change ou qu’une alerte est annoncée, et deux widgets de tableau de bord.

L’AQI va de 0 à 500 (davantage lors des fumées de feux de forêt) : Bon (0-50), Modéré (51-100), Mauvais pour les personnes sensibles (101-150), Mauvais (151-200), Très mauvais (201-300), Dangereux (301 et plus). Les données d’AirNow sont **provisoires** : elles ne sont pas entièrement vérifiées et peuvent changer.

## Prérequis

- Gladys Assistant **5.2.0** ou plus récent (le sélecteur de maison de la configuration). Les instances plus anciennes ne peuvent pas installer l’intégration.
- Une clé d’API AirNow gratuite (ci-dessous).
- Un lieu couvert par AirNow : les États-Unis, et le Canada ou le Mexique via une maison (les codes ZIP sont américains). AirNow répond avec la zone de mesure la plus proche et ses stations, dans un rayon d’environ 80 km.

### Obtenir une clé d’API

1. Ouvrez [Request an AirNow API account](https://docs.airnowapi.org/account/request/) et remplissez le formulaire (un nom et une adresse e-mail).
2. Confirmez l’e-mail, puis [connectez-vous](https://docs.airnowapi.org/login).
3. Ouvrez **Web Services** : votre clé d’API est en haut à droite de la page. Copiez-la.

Une clé permet 500 requêtes par heure ; l’intégration en fait moins de deux par lieu et par heure, et jamais plus de 200 par heure.

## Configuration

| Champ                 | Ce qu’il faut saisir                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------- |
| Clé d’API             | La clé de votre compte AirNow. Stockée en secret, jamais réaffichée ni journalisée.                       |
| Maison (lieu 1, 2, 3) | Une maison de Gladys : sa position (Paramètres → Maisons) situe le lieu. L’intégration demande cet accès. |
| Ou un code ZIP        | Un code postal américain (ZIP), cinq chiffres : `90210`. Prioritaire sur la maison du même lieu.          |
| Langue des textes     | Noms des appareils et textes transmis aux scènes. Automatique : la langue du dernier widget affiché.      |

Deux boutons complètent l’écran : **Lire maintenant** (vérifie la clé, situe les lieux et les lit tout de suite) et **Diagnostic** (l’état de l’intégration dans ses journaux, sans la clé).

## Utilisation

### Appareils

Ouvrez l’onglet **Découverte** de l’intégration et créez un appareil par lieu, nommé d’après sa zone de mesure (« AirNow NW Coastal LA ») :

- **Indice de qualité de l’air** : l’AQI actuel, le plus élevé des polluants mesurés ;
- **PM2,5 (AQI)**, **Ozone (AQI)**, **PM10 (AQI)** : l’AQI de chaque polluant (NowCast, l’indice horaire d’AirNow) ;
- **Qualité de l’air** : la catégorie, en texte ;
- **AQI prévu aujourd’hui** et **AQI prévu demain** : quand l’agence donne un nombre (certaines ne donnent qu’une catégorie) ;
- **Prévision** : « Demain : Modéré (Ozone) », et l’alerte s’il y en a une.

Gladys colore les fonctionnalités AQI sur cette échelle même. Un polluant qu’une station n’a pas envoyé garde sa dernière valeur : aucun 0 n’est inventé. Les mesures sont lues à la 35e minute de chaque heure, une fois publiées par AirNow, et les prévisions toutes les 3 heures.

### Widgets du tableau de bord

![Le widget Qualité de l’air AirNow pour Napa avec l’AQI et trois polluants, et le widget Prévision AirNow sur six jours avec une alerte (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-airnow/main/docs/assets/widgets.fr.png)

- **Qualité de l’air AirNow** : l’AQI actuel dans la couleur de sa catégorie, PM2,5, ozone et PM10, le conseil santé de la catégorie, l’heure de la mesure et l’agence qui l’a faite.
- **Prévision AirNow** : une carte par jour avec sa catégorie et son polluant principal ; un appui affiche le conseil santé et le commentaire du prévisionniste. Une alerte qualité de l’air est annoncée en bas.

Les deux ont un réglage **Lieu** (le premier lieu par défaut) et un bouton **Actualiser**, qui ne relit que si AirNow peut avoir du nouveau.

### Scènes

Déclencheurs :

- **AirNow : qualité de l’air changée** : la catégorie actuelle change. Filtres : lieu, nouvelle catégorie (une ou plusieurs), sens (dégradation, amélioration). Variables : `aqi`, `category`, `category_name`, `previous_category`, `direction`, `pollutant_name`, `area`.
- **AirNow : prévision mise à jour** : la catégorie prévue pour un jour apparaît ou change. Filtres : lieu, jour (aujourd’hui, demain, plus tard), catégorie.
- **AirNow : alerte qualité de l’air** : une prévision annonce un « Air Quality Action Day », une alerte de l’agence locale. Filtres : lieu, jour. Variables : `date`, `aqi`, `category_name`, `pollutant_name`, `discussion`.

Action : **AirNow : lire la qualité de l’air** d’un lieu : l’AQI, la catégorie, la prévision du jour et du lendemain, l’annonce éventuelle d’une alerte, et une phrase `summary` toute faite.

Exemples :

- Quand **la qualité de l’air devient Mauvais pour les personnes sensibles ou pire** → fermer les fenêtres et allumer le purificateur d’air.
- Quand **une alerte qualité de l’air est annoncée pour demain** → envoyer `{{triggerEvent.data.category_name}} prévu demain ({{triggerEvent.data.pollutant_name}})` sur votre téléphone.
- Chaque matin à 7 h → **lire la qualité de l’air** et faire annoncer le `summary` avant le footing.

### Transport

Cloud (`"transports": ["cloud"]`) : l’intégration contacte `www.airnowapi.org` en HTTPS avec votre clé et, pour chaque lieu, le code ZIP ou les coordonnées de la maison (arrondies à une dizaine de mètres). Rien d’autre ne quitte votre réseau. Les lectures sont gardées dans le volume `/data` de l’intégration : un redémarrage ne relit rien qui soit encore frais.

## Dépannage

- **AirNow a refusé la clé d’API** : recopiez-la depuis la page Web Services (sans espace), puis enregistrez la configuration : les lectures reprennent aussitôt.
- **Pas de données près d’un lieu** : le lieu est trop loin d’une zone de mesure ou d’une station (centre du Nevada, hors d’Amérique du Nord). Essayez le code ZIP de la ville la plus proche.
- **La maison n’a pas de position** : renseignez-la dans Paramètres → Maisons, puis cliquez sur **Lire maintenant**.
- **Pas de prévision** : certaines agences ne prévoient qu’une partie de l’année ou certains jours ; le widget le dit.
- **Valeurs différentes d’AirNow.gov de quelques points** : les deux montrent le NowCast de la même heure, mais la zone de mesure et les stations retenues peuvent légèrement différer.
- **Toujours bloqué** : cliquez sur **Diagnostic**, puis ouvrez un ticket sur [GitHub](https://github.com/William-De71/gladys-airnow/issues) avec les versions de Gladys et de l’intégration, le lieu, et les lignes « AirNow diagnostic » des journaux (ajoutez `DEBUG=gladys-integration-sdk` en mode développeur).

Données : U.S. EPA AirNow et ses agences partenaires, données provisoires, affichées telles que reçues.
