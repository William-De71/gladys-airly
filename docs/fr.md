# Airly

## Présentation

[Airly](https://airly.org) exploite un réseau de milliers de capteurs de qualité de l’air, surtout en Pologne et en Europe. Chaque capteur mesure les **particules fines** (PM1, PM2,5, PM10), la plupart la **météo** (température, humidité, pression), certains des **gaz** (NO₂, O₃, SO₂, CO). Airly en tire le **CAQI** (Common Air Quality Index, l’indice européen) et une **prévision des 24 prochaines heures**.

Cette intégration l’amène dans Gladys pour trois lieux au plus, chacun une maison de Gladys ou un capteur Airly : un appareil par lieu, des déclencheurs de scène quand la qualité de l’air change, quand une pollution est prévue ou quand une valeur guide de l’OMS est dépassée, une action de scène, et deux widgets de tableau de bord.

Le CAQI va de 0 à 100 et au-delà : très bonne (0-25), bonne (25-50), moyenne (50-75), mauvaise (75-100), très mauvaise (100 et plus). Le niveau vient toujours de la valeur.

## Prérequis

- Gladys Assistant **5.2.0** ou plus récent (le sélecteur de maison de la configuration). Les instances plus anciennes ne peuvent pas installer l’intégration.
- Une clé d’API Airly gratuite (ci-dessous).
- Un lieu couvert par Airly : une maison avec des capteurs Airly à quelques kilomètres (la carte Airly les montre), ou le numéro d’un capteur.

### Obtenir une clé d’API

1. Ouvrez le [portail développeur d’Airly](https://developer.airly.org/en) et créez un compte.
2. Choisissez l’offre gratuite : votre clé d’API s’affiche sur la page des clés du portail. Copiez-la.

Une clé gratuite permet **100 requêtes par jour** (les clés créées avant 2020 : 1 000), comptées par jour UTC. Une lecture d’un lieu est une requête : l’intégration les répartit d’elle-même entre vos lieux.

### Trouver le numéro d’un capteur

Sur la [carte Airly](https://airly.org/map/en/), cliquez sur un capteur : le numéro de l’installation termine en général l’adresse de la page (`…,i204` pour l’installation 204). Collez le numéro, ou l’adresse entière, dans le champ d’un lieu.

## Configuration

| Champ                         | Que saisir                                                                                                      |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Clé d’API                     | La clé de votre compte Airly. Enregistrée comme secret, jamais réaffichée ni écrite dans les journaux.          |
| Maison (lieu 1, 2, 3)         | Une maison de Gladys : sa position (Paramètres → Maisons) situe le lieu. L’intégration demande cet accès.       |
| Ou un numéro de capteur Airly | Le numéro d’une installation Airly : `204`. Il l’emporte sur la maison du même lieu.                            |
| Qualité de l’air d’une maison | À la position de la maison (Airly interpole les capteurs voisins), ou le capteur le plus proche (3 km au plus). |
| Langue des textes             | Noms des appareils et textes donnés aux scènes. Automatique : la langue du dernier widget affiché.              |

Deux boutons complètent l’écran : **Lire maintenant** (vérifie la clé, situe les lieux et les lit tout de suite) et **Diagnostic** (l’état de l’intégration dans ses journaux, sans la clé ni les coordonnées).

## Utilisation

### Appareils

Ouvrez l’onglet **Découverte** de l’intégration et créez un appareil par lieu (« Airly Maison », « Airly Kraków, Mikołajska ») :

- **Indice de qualité de l’air (CAQI)** et **Qualité de l’air**, son niveau en texte ;
- **PM2,5** et **PM10**, en µg/m³ ;
- **CAQI maximal sous 24 h** et **Prévision de qualité de l’air** : « Maximum sous 24 h : 62, Moyenne, à 18:00 » ;
- dès que le lieu les a donnés : **Température extérieure**, **Humidité extérieure**, **Pression atmosphérique**, **Dioxyde d’azote (NO₂)**, **Ozone (O₃)**, **Dioxyde de soufre (SO₂)**.

Une valeur qu’Airly n’a pas donnée garde la précédente : aucun 0 n’est inventé. Une fonctionnalité proposée ne disparaît jamais. PM1 et CO n’ont pas de catégorie dans Gladys : ils sont dans le widget et l’action de scène.

Tous les lieux sont lus dans la même tournée, aussi souvent que la limite quotidienne de la clé le permet : toutes les 30 minutes avec un lieu, 35 avec deux, 50 avec trois, avec une clé gratuite. Dix requêtes par jour restent en réserve pour **Lire maintenant**, le bouton **Actualiser** et l’action de scène.

### Widgets du tableau de bord

![Le widget Qualité de l’air Airly avec le CAQI, PM1, PM2,5, PM10 et la température, et le widget Prévision Airly avec un graphique des 24 dernières et des 24 prochaines heures et une alerte de pollution (illustration générée, pas une capture d’écran)](https://raw.githubusercontent.com/William-De71/gladys-airly/main/docs/assets/widgets.fr.png)

- **Qualité de l’air Airly** : le CAQI dans la couleur de son niveau, PM1, PM2,5 et PM10 (vert sous la valeur guide de l’OMS, orange jusqu’au double, rouge au-delà), la température, un conseil, l’humidité et la pression.
- **Prévision Airly** : le CAQI des 24 dernières heures et des 24 prochaines sur un graphique, la valeur actuelle, le pic prévu, et une alerte quand il atteint un niveau mauvais.

Les deux ont un réglage **Lieu** (le premier lieu par défaut) et un bouton **Actualiser**, qui ne relit qu’au-delà de 15 minutes. Un widget ne dépense jamais de requête de lui-même : il montre la dernière lecture.

### Scènes

Déclencheurs :

- **Airly : qualité de l’air changée** : le niveau du CAQI change. Filtres : lieu, nouveau niveau (un ou plusieurs), sens (dégradation, amélioration). Variables : `caqi`, `level`, `level_name`, `previous_level`, `direction`, `pm25`, `pm10`, `name`.
- **Airly : pollution prévue** : la prévision des 24 prochaines heures atteint un niveau mauvais ou très mauvais ; une fois par épisode, de nouveau s’il s’aggrave. Filtres : lieu, niveau. Variables : `caqi`, `level_name`, `time`, `hours`, `current_caqi`.
- **Airly : seuil OMS dépassé** : PM2,5, PM10, NO₂ ou ozone de la dernière heure dépasse la valeur guide de l’OMS ; de nouveau seulement après être repassé en dessous. Filtres : lieu, polluant. Variables : `pollutant_name`, `value`, `limit`, `percent`.

Action : **Airly : lire la qualité de l’air** d’un lieu : le CAQI et son niveau, PM1, PM2,5, PM10, la météo, les pourcentages OMS, le pic prévu, et une phrase toute prête `summary`.

Exemples :

- Quand **la qualité de l’air devient mauvaise ou très mauvaise** → fermer les fenêtres et allumer le purificateur d’air.
- Quand **une pollution est prévue** → envoyer `Qualité de l’air {{triggerEvent.data.level_name}} attendue vers {{triggerEvent.data.time}}` sur votre téléphone.
- Chaque matin à 7 h → **lire la qualité de l’air** et faire dire le `summary` avant le footing.

### Transport

Cloud (`"transports": ["cloud"]`) : l’intégration contacte `airapi.airly.eu` en HTTPS avec votre clé (dans un en-tête) et, pour chaque lieu, le numéro du capteur ou les coordonnées de la maison (arrondies à environ 10 m). Rien d’autre ne quitte votre réseau. Les lectures et les requêtes du jour sont gardées dans le volume `/data` de l’intégration : un redémarrage ne relit rien de récent.

## Dépannage

- **Airly a refusé la clé d’API** : recopiez-la depuis le portail développeur (sans espace), puis enregistrez la configuration : les lectures reprennent aussitôt.
- **Aucun capteur près d’un lieu** : Airly n’a rien à portée de la maison. Choisissez le mode « Capteur le plus proche », le numéro d’un capteur, ou un autre lieu.
- **La limite quotidienne de la clé est atteinte** : les lectures reprennent après minuit UTC. Avec trois lieux et beaucoup d’appuis sur Actualiser, la réserve s’épuise plus vite.
- **La maison n’a pas de position** : renseignez-la dans Paramètres → Maisons, puis appuyez sur **Lire maintenant**.
- **Pas de prévision** : Airly ne prévoit que pour une partie de ses capteurs ; le widget le dit.
- **Toujours bloqué** : appuyez sur **Diagnostic**, puis ouvrez une issue sur [GitHub](https://github.com/William-De71/gladys-airly/issues) avec les versions de Gladys et de l’intégration, et les lignes « Airly diagnostic » des journaux (ajoutez `DEBUG=gladys-integration-sdk` en mode développeur).

Données fournies par Airly. Cette intégration communautaire n’est pas affiliée à Airly.
