# AirNow

## Überblick

[AirNow](https://www.airnow.gov) ist das Luftqualitätsprogramm der US-Umweltbehörde EPA und von mehr als 150 Behörden der Bundesstaaten, Kommunen und Stämme. Es veröffentlicht den **Luftqualitätsindex (AQI)**, den über 2.500 Messstationen stündlich erfassen, und die Vorhersagen für mehr als 500 Städte in den USA, Kanada und Mexiko.

Diese Integration holt ihn für bis zu drei Orte in Gladys, jeweils ein Haus in Gladys oder eine ZIP-Postleitzahl: den aktuellen AQI mit PM2,5, Ozon und PM10, die Vorhersage der nächsten Tage, Szenen-Auslöser, wenn sich die Luftqualität ändert oder eine Warnung angekündigt wird, und zwei Dashboard-Widgets.

Der AQI reicht von 0 bis 500 (bei Waldbrandrauch mehr): Gut (0-50), Mäßig (51-100), Ungesund für empfindliche Gruppen (101-150), Ungesund (151-200), Sehr ungesund (201-300), Gefährlich (ab 301). Die Daten von AirNow sind **vorläufig**: sie sind nicht vollständig geprüft und können sich ändern.

## Voraussetzungen

- Gladys Assistant **5.2.0** oder neuer (die Hausauswahl der Konfiguration). Ältere Instanzen können die Integration nicht installieren.
- Ein kostenloser AirNow-API-Schlüssel (unten).
- Ein von AirNow abgedeckter Ort: die USA, sowie Kanada oder Mexiko über ein Haus (ZIP-Postleitzahlen gibt es nur in den USA). AirNow antwortet mit dem nächsten Berichtsgebiet und seinen Messstationen im Umkreis von etwa 80 km.

### Einen API-Schlüssel erhalten

1. Öffne [Request an AirNow API account](https://docs.airnowapi.org/account/request/) und fülle das Formular aus (ein Name und eine E-Mail-Adresse).
2. Bestätige die E-Mail und [melde dich an](https://docs.airnowapi.org/login).
3. Öffne **Web Services**: dein API-Schlüssel steht oben rechts auf der Seite. Kopiere ihn.

Ein Schlüssel erlaubt 500 Anfragen pro Stunde; die Integration stellt weniger als zwei pro Ort und Stunde und nie mehr als 200 pro Stunde.

## Konfiguration

| Feld                       | Was einzutragen ist                                                                                                   |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| API-Schlüssel              | Der Schlüssel deines AirNow-Kontos. Als Geheimnis gespeichert, nie wieder angezeigt oder protokolliert.               |
| Haus (Ort 1, 2, 3)         | Ein Haus in Gladys: sein Standort (Einstellungen → Häuser) bestimmt den Ort. Die Integration fragt diesen Zugriff an. |
| Oder eine ZIP-Postleitzahl | Eine US-Postleitzahl, fünf Ziffern: `90210`. Hat Vorrang vor dem Haus desselben Orts.                                 |
| Sprache der Texte          | Gerätenamen und die an Szenen übergebenen Texte. Automatisch: die Sprache des zuletzt angezeigten Widgets.            |

Zwei Schaltflächen ergänzen die Seite: **Jetzt lesen** (prüft den Schlüssel, ermittelt die Orte und liest sie sofort) und **Diagnose** (der Zustand der Integration in ihren Logs, ohne den Schlüssel).

## Verwendung

### Geräte

Öffne den Tab **Entdecken** der Integration und lege ein Gerät pro Ort an, benannt nach seinem Berichtsgebiet („AirNow NW Coastal LA“):

- **Luftqualitätsindex**: der aktuelle AQI, der höchste der gemessenen Schadstoffe;
- **PM2,5 (AQI)**, **Ozon (AQI)**, **PM10 (AQI)**: der AQI jedes Schadstoffs (NowCast, der Stundenindex von AirNow);
- **Luftqualität**: die Kategorie als Text;
- **Vorhergesagter AQI heute** und **Vorhergesagter AQI morgen**: wenn die Behörde eine Zahl angibt (manche nur eine Kategorie);
- **Vorhersage**: „Morgen: Mäßig (Ozon)“ und die Warnung, falls es eine gibt.

Gladys färbt die AQI-Funktionen nach genau dieser Skala. Ein Schadstoff, den eine Station nicht gesendet hat, behält seinen letzten Wert: es wird keine 0 erfunden. Die Messwerte werden jeweils zur 35. Minute gelesen, sobald AirNow sie veröffentlicht hat, die Vorhersagen alle 3 Stunden.

### Dashboard-Widgets

![Das Widget AirNow-Luftqualität für Napa mit dem AQI und drei Schadstoffen und das Widget AirNow-Vorhersage über sechs Tage mit einer Warnung (generierte Illustration, kein Bildschirmfoto)](https://raw.githubusercontent.com/William-De71/gladys-airnow/main/docs/assets/widgets.de.png)

- **AirNow-Luftqualität**: der aktuelle AQI in der Farbe seiner Kategorie, PM2,5, Ozon und PM10, der Gesundheitshinweis der Kategorie, die Uhrzeit der Messung und die messende Behörde.
- **AirNow-Vorhersage**: eine Karte pro Tag mit Kategorie und Hauptschadstoff; ein Tippen zeigt den Gesundheitshinweis und den Kommentar der Vorhersage. Eine Luftqualitätswarnung wird unten angekündigt.

Beide haben eine Einstellung **Ort** (standardmäßig der erste Ort) und eine Schaltfläche **Aktualisieren**, die nur neu liest, wenn AirNow Neues haben kann.

### Szenen

Auslöser:

- **AirNow: Luftqualität geändert**: die aktuelle Kategorie ändert sich. Filter: Ort, neue Kategorie (eine oder mehrere), Richtung (schlechter, besser). Variablen: `aqi`, `category`, `category_name`, `previous_category`, `direction`, `pollutant_name`, `area`.
- **AirNow: Vorhersage aktualisiert**: die vorhergesagte Kategorie eines Tages erscheint oder ändert sich. Filter: Ort, Tag (heute, morgen, später), Kategorie.
- **AirNow: Luftqualitätswarnung**: eine Vorhersage kündigt einen Air Quality Action Day an, eine Warnung der örtlichen Behörde. Filter: Ort, Tag. Variablen: `date`, `aqi`, `category_name`, `pollutant_name`, `discussion`.

Aktion: **AirNow: Luftqualität lesen** für einen Ort: der AQI, die Kategorie, die Vorhersage für heute und morgen, ob eine Warnung angekündigt ist, und ein fertiger Satz `summary`.

Beispiele:

- Wenn **die Luftqualität „Ungesund für empfindliche Gruppen“ oder schlechter wird** → Fenster schließen und den Luftreiniger einschalten.
- Wenn **für morgen eine Luftqualitätswarnung angekündigt wird** → `{{triggerEvent.data.category_name}} für morgen erwartet ({{triggerEvent.data.pollutant_name}})` an dein Handy senden.
- Jeden Morgen um 7:00 → **Luftqualität lesen** und den `summary` vor dem Laufen ansagen lassen.

### Transport

Cloud (`"transports": ["cloud"]`): Die Integration kontaktiert `www.airnowapi.org` per HTTPS mit deinem Schlüssel und je Ort der ZIP-Postleitzahl oder den Koordinaten des Hauses (auf etwa 10 m gerundet). Sonst verlässt nichts dein Netzwerk. Die Lesungen werden im Volume `/data` der Integration gehalten: ein Neustart liest nichts, was noch aktuell ist.

## Fehlerbehebung

- **AirNow hat den API-Schlüssel abgelehnt**: kopiere ihn erneut von der Seite Web Services (ohne Leerzeichen) und speichere die Konfiguration: die Lesungen laufen sofort wieder.
- **Keine Daten nahe einem Ort**: der Ort ist zu weit von einem Berichtsgebiet oder einer Station entfernt (Zentral-Nevada, außerhalb Nordamerikas). Versuche die ZIP-Postleitzahl der nächsten Stadt.
- **Das Haus hat keinen Standort**: trage ihn unter Einstellungen → Häuser ein und klicke dann auf **Jetzt lesen**.
- **Keine Vorhersage**: manche Behörden erstellen nur einen Teil des Jahres oder an manchen Tagen Vorhersagen; das Widget sagt es.
- **Werte weichen um einige Punkte von AirNow.gov ab**: beide zeigen den NowCast derselben Stunde, aber das Berichtsgebiet und die gewählten Stationen können leicht abweichen.
- **Weiterhin Probleme**: klicke auf **Diagnose** und eröffne ein Issue auf [GitHub](https://github.com/William-De71/gladys-airnow/issues) mit den Versionen von Gladys und der Integration, dem Ort und den Zeilen „AirNow diagnostic“ aus den Logs (im Entwicklermodus `DEBUG=gladys-integration-sdk` hinzufügen).

Daten: U.S. EPA AirNow und seine Partnerbehörden, vorläufige Daten, unverändert angezeigt.
