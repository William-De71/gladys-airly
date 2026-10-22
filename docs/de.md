# Airly

## Überblick

[Airly](https://airly.org) betreibt ein Netz aus Tausenden Luftqualitätssensoren, vor allem in Polen und in Europa. Jeder Sensor misst **Feinstaub** (PM1, PM2,5, PM10), die meisten das **Wetter** (Temperatur, Luftfeuchtigkeit, Luftdruck), manche **Gase** (NO₂, O₃, SO₂, CO). Airly berechnet daraus den **CAQI** (Common Air Quality Index, den europäischen Index) und eine **Vorhersage der nächsten 24 Stunden**.

Diese Integration bringt ihn für bis zu drei Orte in Gladys, jeder ein Haus von Gladys oder ein Airly-Sensor: ein Gerät pro Ort, Szenenauslöser, wenn sich die Luftqualität ändert, Verschmutzung erwartet wird oder ein WHO-Richtwert überschritten wird, eine Szenenaktion und zwei Dashboard-Widgets.

Der CAQI reicht von 0 bis 100 und darüber: sehr gut (0-25), gut (25-50), mäßig (50-75), schlecht (75-100), sehr schlecht (100 und mehr). Die Stufe ergibt sich immer aus dem Wert.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer (die Hausauswahl der Konfiguration). Ältere Instanzen können die Integration nicht installieren.
- Ein kostenloser Airly-API-Schlüssel (siehe unten).
- Ein von Airly abgedeckter Ort: ein Haus mit Airly-Sensoren im Umkreis weniger Kilometer (die Airly-Karte zeigt sie) oder die Nummer eines Sensors.

### Einen API-Schlüssel erhalten

1. Öffne das [Entwicklerportal von Airly](https://developer.airly.org/en) und lege ein Konto an.
2. Wähle den kostenlosen Tarif: dein API-Schlüssel steht auf der Seite der API-Schlüssel des Portals. Kopiere ihn.

Ein kostenloser Schlüssel erlaubt **100 Anfragen pro Tag** (vor 2020 erstellte Schlüssel: 1.000), gezählt pro UTC-Tag. Eine Lesung eines Ortes ist eine Anfrage: die Integration verteilt sie selbst auf deine Orte.

### Die Nummer eines Sensors finden

Klicke auf der [Airly-Karte](https://airly.org/map/en/) auf einen Sensor: die Nummer der Installation steht meist am Ende der Adresse der Seite (`…,i204` für die Installation 204). Füge die Nummer oder die ganze Adresse in das Feld eines Ortes ein.

## Konfiguration

| Feld                         | Was eingeben                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| API-Schlüssel                | Der Schlüssel deines Airly-Kontos. Als Geheimnis gespeichert, nie wieder angezeigt und nie in den Logs.                  |
| Haus (Ort 1, 2, 3)           | Ein Haus von Gladys: sein Standort (Einstellungen → Häuser) bestimmt den Ort. Die Integration fragt nach diesem Zugriff. |
| Oder eine Airly-Sensornummer | Die Nummer einer Airly-Installation: `204`. Sie hat Vorrang vor dem Haus desselben Ortes.                                |
| Luftqualität eines Hauses    | Am Standort des Hauses (Airly interpoliert die umliegenden Sensoren) oder der nächste Sensor (höchstens 3 km).           |
| Sprache der Texte            | Namen der Geräte und Texte für die Szenen. Automatisch: die Sprache des zuletzt angezeigten Widgets.                     |

Zwei Knöpfe ergänzen die Seite: **Jetzt lesen** (prüft den Schlüssel, ermittelt die Orte und liest sie sofort) und **Diagnose** (der Zustand der Integration in ihren Logs, ohne den Schlüssel und die Koordinaten).

## Verwendung

### Geräte

Öffne den Tab **Entdecken** der Integration und lege ein Gerät pro Ort an („Airly Zuhause“, „Airly Kraków, Mikołajska“):

- **Luftqualitätsindex (CAQI)** und **Luftqualität**, seine Stufe als Text;
- **PM2,5** und **PM10**, in µg/m³;
- **Höchster CAQI in 24 Std.** und **Luftqualitätsvorhersage**: „Höchstwert in 24 Std.: 62, Mäßig, um 18:00“;
- sobald der Ort sie geliefert hat: **Außentemperatur**, **Außenluftfeuchtigkeit**, **Luftdruck**, **Stickstoffdioxid (NO₂)**, **Ozon (O₃)**, **Schwefeldioxid (SO₂)**.

Ein Wert, den Airly nicht geliefert hat, behält den vorherigen: es wird keine 0 erfunden. Eine angebotene Funktion verschwindet nie. PM1 und CO haben in Gladys keine Kategorie: sie stehen im Widget und in der Szenenaktion.

Alle Orte werden in derselben Runde gelesen, so oft es das Tageslimit des Schlüssels erlaubt: alle 30 Minuten mit einem Ort, 35 mit zwei, 50 mit drei, mit einem kostenlosen Schlüssel. Zehn Anfragen pro Tag bleiben in Reserve für **Jetzt lesen**, den Knopf **Aktualisieren** und die Szenenaktion.

### Dashboard-Widgets

![Das Widget Airly-Luftqualität mit dem CAQI, PM1, PM2,5, PM10 und der Temperatur, und das Widget Airly-Vorhersage mit einem Diagramm der letzten und der nächsten 24 Stunden und einer Verschmutzungswarnung (generierte Illustration, kein Screenshot)](https://raw.githubusercontent.com/William-De71/gladys-airly/main/docs/assets/widgets.de.png)

- **Airly-Luftqualität**: der CAQI in der Farbe seiner Stufe, PM1, PM2,5 und PM10 (grün unter dem WHO-Richtwert, orange bis zum Doppelten, rot darüber), die Temperatur, ein Rat, Luftfeuchtigkeit und Luftdruck.
- **Airly-Vorhersage**: der CAQI der letzten und der nächsten 24 Stunden in einem Diagramm, der aktuelle Wert, die erwartete Spitze und eine Warnung, wenn sie eine schlechte Stufe erreicht.

Beide haben die Einstellung **Ort** (standardmäßig der erste Ort) und einen Knopf **Aktualisieren**, der erst nach 15 Minuten neu liest. Ein Widget verbraucht nie selbst eine Anfrage: es zeigt die letzte Lesung.

### Szenen

Auslöser:

- **Airly: Luftqualität geändert**: die Stufe des CAQI ändert sich. Filter: Ort, neue Stufe (eine oder mehrere), Richtung (schlechter, besser). Variablen: `caqi`, `level`, `level_name`, `previous_level`, `direction`, `pm25`, `pm10`, `name`.
- **Airly: Verschmutzung erwartet**: die Vorhersage der nächsten 24 Stunden erreicht eine schlechte oder sehr schlechte Stufe; einmal pro Episode, erneut, wenn sie sich verschlimmert. Filter: Ort, Stufe. Variablen: `caqi`, `level_name`, `time`, `hours`, `current_caqi`.
- **Airly: WHO-Richtwert überschritten**: PM2,5, PM10, NO₂ oder Ozon der letzten Stunde überschreitet den WHO-Richtwert; erneut erst, nachdem er wieder darunter lag. Filter: Ort, Schadstoff. Variablen: `pollutant_name`, `value`, `limit`, `percent`.

Aktion: **Airly: Luftqualität lesen** eines Ortes: der CAQI und seine Stufe, PM1, PM2,5, PM10, das Wetter, die WHO-Prozente, die erwartete Spitze und ein fertiger Satz `summary`.

Beispiele:

- Wenn **die Luftqualität schlecht oder sehr schlecht wird** → die Fenster schließen und den Luftreiniger einschalten.
- Wenn **Verschmutzung erwartet wird** → `Luftqualität {{triggerEvent.data.level_name}} gegen {{triggerEvent.data.time}} erwartet` an dein Handy senden.
- Jeden Morgen um 7:00 → **die Luftqualität lesen** und vor dem Laufen den `summary` vorlesen lassen.

### Transport

Cloud (`"transports": ["cloud"]`): die Integration kontaktiert `airapi.airly.eu` über HTTPS mit deinem Schlüssel (in einem Header) und, pro Ort, der Nummer des Sensors oder den Koordinaten des Hauses (auf etwa 10 m gerundet). Sonst verlässt nichts dein Netzwerk. Die Lesungen und die Anfragen des Tages werden im Volume `/data` der Integration gespeichert: ein Neustart liest nichts, was noch aktuell ist.

## Fehlerbehebung

- **Airly hat den API-Schlüssel abgelehnt**: kopiere ihn erneut aus dem Entwicklerportal (ohne Leerzeichen) und speichere die Konfiguration: die Lesungen gehen sofort weiter.
- **Kein Sensor nahe einem Ort**: Airly hat nichts in Reichweite des Hauses. Wähle den Modus „Nächster Sensor“, die Nummer eines Sensors oder einen anderen Ort.
- **Das Tageslimit des Schlüssels ist erreicht**: die Lesungen gehen nach Mitternacht UTC weiter. Mit drei Orten und vielen Klicks auf Aktualisieren ist die Reserve schneller aufgebraucht.
- **Das Haus hat keinen Standort**: trage ihn unter Einstellungen → Häuser ein und drücke dann **Jetzt lesen**.
- **Keine Vorhersage**: Airly erstellt sie nur für einen Teil seiner Sensoren; das Widget sagt es.
- **Immer noch ein Problem**: drücke **Diagnose** und eröffne dann ein Issue auf [GitHub](https://github.com/William-De71/gladys-airly/issues) mit den Versionen von Gladys und der Integration und den Zeilen „Airly diagnostic“ der Logs (im Entwicklermodus `DEBUG=gladys-integration-sdk` hinzufügen).

Daten bereitgestellt von Airly. Diese Community-Integration ist nicht mit Airly verbunden.
