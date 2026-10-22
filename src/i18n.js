// -----------------------------------------------------------------------------
// Texts of the integration, in English, French, German and Spanish (English
// fallback).
//
// The manifest carries its own labels; these are the texts the code writes at
// runtime: device and feature names, CAQI levels and their advice, widget
// contents, statuses, scene texts. Airly speaks English and Polish only: its
// own texts (descriptions, advice) are never shown, the levels come from the
// value (caqi.js). Vocabulary of the Gladys interface (appareil / Gerät /
// dispositivo); German says "du", Spanish "usted". Place names and the
// addresses of the sensors are never translated.
// -----------------------------------------------------------------------------

const LANGUAGES = ['en', 'fr', 'de', 'es'];

const TEXTS = {
  // devices
  deviceName: { en: 'Airly {name}', fr: 'Airly {name}', de: 'Airly {name}', es: 'Airly {name}' },
  featureCaqi: {
    en: 'Air quality index (CAQI)',
    fr: 'Indice de qualité de l’air (CAQI)',
    de: 'Luftqualitätsindex (CAQI)',
    es: 'Índice de calidad del aire (CAQI)',
  },
  featureLevel: {
    en: 'Air quality',
    fr: 'Qualité de l’air',
    de: 'Luftqualität',
    es: 'Calidad del aire',
  },
  featurePm25: { en: 'PM2.5', fr: 'PM2,5', de: 'PM2,5', es: 'PM2,5' },
  featurePm10: { en: 'PM10', fr: 'PM10', de: 'PM10', es: 'PM10' },
  featureTemperature: {
    en: 'Outdoor temperature',
    fr: 'Température extérieure',
    de: 'Außentemperatur',
    es: 'Temperatura exterior',
  },
  featureHumidity: {
    en: 'Outdoor humidity',
    fr: 'Humidité extérieure',
    de: 'Außenluftfeuchtigkeit',
    es: 'Humedad exterior',
  },
  featurePressure: {
    en: 'Atmospheric pressure',
    fr: 'Pression atmosphérique',
    de: 'Luftdruck',
    es: 'Presión atmosférica',
  },
  featureNo2: {
    en: 'Nitrogen dioxide (NO₂)',
    fr: 'Dioxyde d’azote (NO₂)',
    de: 'Stickstoffdioxid (NO₂)',
    es: 'Dióxido de nitrógeno (NO₂)',
  },
  featureO3: { en: 'Ozone (O₃)', fr: 'Ozone (O₃)', de: 'Ozon (O₃)', es: 'Ozono (O₃)' },
  featureSo2: {
    en: 'Sulfur dioxide (SO₂)',
    fr: 'Dioxyde de soufre (SO₂)',
    de: 'Schwefeldioxid (SO₂)',
    es: 'Dióxido de azufre (SO₂)',
  },
  featureForecastCaqi: {
    en: 'Highest CAQI within 24 h',
    fr: 'CAQI maximal sous 24 h',
    de: 'Höchster CAQI in 24 Std.',
    es: 'CAQI máximo en 24 h',
  },
  featureForecast: {
    en: 'Air quality forecast',
    fr: 'Prévision de qualité de l’air',
    de: 'Luftqualitätsvorhersage',
    es: 'Previsión de calidad del aire',
  },

  // CAQI levels: full names, short ones (badges and tiles), advice
  level_very_low: { en: 'Very good', fr: 'Très bonne', de: 'Sehr gut', es: 'Muy buena' },
  level_low: { en: 'Good', fr: 'Bonne', de: 'Gut', es: 'Buena' },
  level_medium: { en: 'Moderate', fr: 'Moyenne', de: 'Mäßig', es: 'Moderada' },
  level_high: { en: 'Poor', fr: 'Mauvaise', de: 'Schlecht', es: 'Mala' },
  level_very_high: { en: 'Very poor', fr: 'Très mauvaise', de: 'Sehr schlecht', es: 'Muy mala' },
  short_very_low: { en: 'Very good', fr: 'Très bonne', de: 'Sehr gut', es: 'Muy buena' },
  short_low: { en: 'Good', fr: 'Bonne', de: 'Gut', es: 'Buena' },
  short_medium: { en: 'Moderate', fr: 'Moyenne', de: 'Mäßig', es: 'Moderada' },
  short_high: { en: 'Poor', fr: 'Mauvaise', de: 'Schlecht', es: 'Mala' },
  short_very_high: { en: 'Very poor', fr: 'Très mauvaise', de: 'Sehr schlecht', es: 'Muy mala' },
  advice_very_low: {
    en: 'Clean air: a great time to air the house and be active outside.',
    fr: 'Air pur : un bon moment pour aérer la maison et bouger dehors.',
    de: 'Saubere Luft: ein guter Moment, um zu lüften und draußen aktiv zu sein.',
    es: 'Aire limpio: un buen momento para ventilar la casa y estar activo al aire libre.',
  },
  advice_low: {
    en: 'No reason to limit outdoor activities.',
    fr: 'Aucune raison de limiter les activités dehors.',
    de: 'Kein Grund, Aktivitäten im Freien einzuschränken.',
    es: 'Ninguna razón para limitar las actividades al aire libre.',
  },
  advice_medium: {
    en: 'Sensitive people should make long or intense outdoor efforts lighter.',
    fr: 'Les personnes sensibles devraient alléger les efforts longs ou intenses dehors.',
    de: 'Empfindliche Menschen sollten lange oder intensive Anstrengungen im Freien reduzieren.',
    es: 'Las personas sensibles deberían reducir los esfuerzos largos o intensos al aire libre.',
  },
  advice_high: {
    en: 'Polluted air: limit outdoor efforts and keep windows closed.',
    fr: 'Air pollué : limitez les efforts dehors et gardez les fenêtres fermées.',
    de: 'Verschmutzte Luft: Anstrengungen im Freien begrenzen und Fenster geschlossen halten.',
    es: 'Aire contaminado: limite los esfuerzos al aire libre y mantenga las ventanas cerradas.',
  },
  advice_very_high: {
    en: 'Heavily polluted air: stay indoors if you can, windows closed, purifier on.',
    fr: 'Air très pollué : restez à l’intérieur si possible, fenêtres fermées, purificateur allumé.',
    de: 'Stark verschmutzte Luft: bleib möglichst drinnen, Fenster zu, Luftreiniger an.',
    es: 'Aire muy contaminado: quédese en casa si puede, ventanas cerradas, purificador encendido.',
  },

  // pollutants
  pollutant_pm25: { en: 'PM2.5', fr: 'PM2,5', de: 'PM2,5', es: 'PM2,5' },
  pollutant_pm10: { en: 'PM10', fr: 'PM10', de: 'PM10', es: 'PM10' },
  pollutant_no2: { en: 'NO₂', fr: 'NO₂', de: 'NO₂', es: 'NO₂' },
  pollutant_o3: { en: 'Ozone', fr: 'Ozone', de: 'Ozon', es: 'Ozono' },

  // forecast text of the device, summaries
  forecastText: {
    en: 'Highest within 24 h: {caqi}, {level}, at {time}',
    fr: 'Maximum sous 24 h : {caqi}, {level}, à {time}',
    de: 'Höchstwert in 24 Std.: {caqi}, {level}, um {time}',
    es: 'Máximo en 24 h: {caqi}, {level}, a las {time}',
  },
  summaryNow: {
    en: 'Air quality at {name}: {level}, CAQI {caqi}, PM2.5 {pm25} µg/m³.',
    fr: 'Qualité de l’air à {name} : {level}, CAQI {caqi}, PM2,5 {pm25} µg/m³.',
    de: 'Luftqualität in {name}: {level}, CAQI {caqi}, PM2,5 {pm25} µg/m³.',
    es: 'Calidad del aire en {name}: {level}, CAQI {caqi}, PM2,5 {pm25} µg/m³.',
  },
  summaryNoNow: {
    en: 'No current measurement for {name}.',
    fr: 'Aucune mesure en cours pour {name}.',
    de: 'Keine aktuelle Messung für {name}.',
    es: 'No hay medición actual para {name}.',
  },
  summaryForecast: {
    en: 'Highest within 24 hours: {level} ({caqi}) at {time}.',
    fr: 'Maximum sous 24 heures : {level} ({caqi}) à {time}.',
    de: 'Höchstwert in 24 Stunden: {level} ({caqi}) um {time}.',
    es: 'Máximo en 24 horas: {level} ({caqi}) a las {time}.',
  },

  // connection status and errors
  statusConnected: {
    en: 'Connected to Airly: {places}. {usage}',
    fr: 'Connecté à Airly : {places}. {usage}',
    de: 'Mit Airly verbunden: {places}. {usage}',
    es: 'Conectado a Airly: {places}. {usage}',
  },
  statusUsage: {
    en: '{count}/{limit} requests today.',
    fr: '{count}/{limit} requêtes aujourd’hui.',
    de: '{count}/{limit} Anfragen heute.',
    es: '{count}/{limit} solicitudes hoy.',
  },
  statusNoPlace: {
    en: 'Connected to Airly. Choose a house or an Airly sensor in the configuration.',
    fr: 'Connecté à Airly. Choisissez une maison ou un capteur Airly dans la configuration.',
    de: 'Mit Airly verbunden. Wähle in der Konfiguration ein Haus oder einen Airly-Sensor.',
    es: 'Conectado a Airly. Elija una casa o un sensor Airly en la configuración.',
  },
  statusSomeFailing: {
    en: '{ok} of {total} places read. {detail}',
    fr: '{ok} lieu(x) lu(s) sur {total}. {detail}',
    de: '{ok} von {total} Orten gelesen. {detail}',
    es: '{ok} de {total} lugares leídos. {detail}',
  },
  statusPaused: {
    en: 'Airly: the daily limit of the key is reached, readings resume after midnight UTC.',
    fr: 'Airly : la limite quotidienne de la clé est atteinte, les lectures reprennent après minuit UTC.',
    de: 'Airly: das Tageslimit des Schlüssels ist erreicht, die Lesungen gehen nach Mitternacht UTC weiter.',
    es: 'Airly: se alcanzó el límite diario de la clave, las lecturas se reanudan tras la medianoche UTC.',
  },
  errNoKey: {
    en: 'Enter your Airly API key in the configuration (free at developer.airly.org).',
    fr: 'Saisissez votre clé d’API Airly dans la configuration (gratuite sur developer.airly.org).',
    de: 'Gib deinen Airly-API-Schlüssel in der Konfiguration ein (kostenlos auf developer.airly.org).',
    es: 'Introduzca su clave de API de Airly en la configuración (gratuita en developer.airly.org).',
  },
  errAuth: {
    en: 'Airly refused the API key: check it on developer.airly.org.',
    fr: 'Airly a refusé la clé d’API : vérifiez-la sur developer.airly.org.',
    de: 'Airly hat den API-Schlüssel abgelehnt: prüfe ihn auf developer.airly.org.',
    es: 'Airly rechazó la clave de API: compruébela en developer.airly.org.',
  },
  errNoData: {
    en: 'Airly has no sensor near {place} yet: choose the mode “Nearest sensor” or another place.',
    fr: 'Airly n’a pas encore de capteur près de {place} : choisissez le mode « Capteur le plus proche » ou un autre lieu.',
    de: 'Airly hat noch keinen Sensor nahe {place}: wähle den Modus „Nächster Sensor“ oder einen anderen Ort.',
    es: 'Airly aún no tiene sensores cerca de {place}: elija el modo «Sensor más cercano» u otro lugar.',
  },
  errNoMeasurement: {
    en: 'The sensor {place} sent no recent measurement: it may be offline. The next reading tries again.',
    fr: 'Le capteur {place} n’a envoyé aucune mesure récente : il est peut-être hors ligne. La prochaine lecture réessaiera.',
    de: 'Der Sensor {place} hat keine aktuelle Messung gesendet: er ist vielleicht offline. Die nächste Lesung versucht es erneut.',
    es: 'El sensor {place} no envió ninguna medición reciente: quizá esté desconectado. La próxima lectura volverá a intentarlo.',
  },
  errNotFound: {
    en: 'Airly does not know the sensor {place}: check its number on the Airly map.',
    fr: 'Airly ne connaît pas le capteur {place} : vérifiez son numéro sur la carte Airly.',
    de: 'Airly kennt den Sensor {place} nicht: prüfe seine Nummer auf der Airly-Karte.',
    es: 'Airly no conoce el sensor {place}: compruebe su número en el mapa de Airly.',
  },
  errRateLimit: {
    en: 'Airly refused the request: the daily limit of the key is reached until midnight UTC.',
    fr: 'Airly a refusé la requête : la limite quotidienne de la clé est atteinte jusqu’à minuit UTC.',
    de: 'Airly hat die Anfrage abgelehnt: das Tageslimit des Schlüssels ist bis Mitternacht UTC erreicht.',
    es: 'Airly rechazó la solicitud: se alcanzó el límite diario de la clave hasta la medianoche UTC.',
  },
  errUnreachable: {
    en: 'Airly does not answer: the next reading tries again.',
    fr: 'Airly ne répond pas : la prochaine lecture réessaiera.',
    de: 'Airly antwortet nicht: die nächste Lesung versucht es erneut.',
    es: 'Airly no responde: la próxima lectura volverá a intentarlo.',
  },
  errInvalidInstallation: {
    en: '“{value}” is not an Airly sensor number.',
    fr: '« {value} » n’est pas un numéro de capteur Airly.',
    de: '„{value}“ ist keine Airly-Sensornummer.',
    es: '«{value}» no es un número de sensor Airly.',
  },
  errUnknownHouse: {
    en: 'Place {slot}: the house no longer exists in Gladys.',
    fr: 'Lieu {slot} : la maison n’existe plus dans Gladys.',
    de: 'Ort {slot}: das Haus existiert in Gladys nicht mehr.',
    es: 'Lugar {slot}: la casa ya no existe en Gladys.',
  },
  errHouseNoLocation: {
    en: 'Place {slot}: the house has no location in Gladys (Settings → Houses).',
    fr: 'Lieu {slot} : la maison n’a pas de position dans Gladys (Paramètres → Maisons).',
    de: 'Ort {slot}: das Haus hat in Gladys keinen Standort (Einstellungen → Häuser).',
    es: 'Lugar {slot}: la casa no tiene ubicación en Gladys (Ajustes → Casas).',
  },
  errFailed: {
    en: 'Airly answered with an error: {detail}',
    fr: 'Airly a répondu par une erreur : {detail}',
    de: 'Airly hat mit einem Fehler geantwortet: {detail}',
    es: 'Airly respondió con un error: {detail}',
  },

  // configuration actions
  readDone: {
    en: 'Read now: {places}.',
    fr: 'Lu maintenant : {places}.',
    de: 'Jetzt gelesen: {places}.',
    es: 'Leído ahora: {places}.',
  },
  placeLine: {
    en: '{name} CAQI {caqi} ({level})',
    fr: '{name} CAQI {caqi} ({level})',
    de: '{name} CAQI {caqi} ({level})',
    es: '{name} CAQI {caqi} ({level})',
  },
  diagnosticDone: {
    en: 'Diagnostic written to the logs of the integration ({count} line(s) “Airly diagnostic”), without the API key.',
    fr: 'Diagnostic écrit dans les journaux de l’intégration ({count} ligne(s) « Airly diagnostic »), sans la clé d’API.',
    de: 'Diagnose in die Logs der Integration geschrieben ({count} Zeile(n) „Airly diagnostic“), ohne den API-Schlüssel.',
    es: 'Diagnóstico escrito en los registros de la integración ({count} línea(s) «Airly diagnostic»), sin la clave de API.',
  },

  // widgets
  measuredAt: {
    en: 'Measured {time}',
    fr: 'Mesuré à {time}',
    de: 'Gemessen um {time}',
    es: 'Medido a las {time}',
  },
  tileTemperature: { en: 'Temperature', fr: 'Température', de: 'Temperatur', es: 'Temperatura' },
  humidityText: {
    en: 'Humidity {value} %',
    fr: 'Humidité {value} %',
    de: 'Luftfeuchtigkeit {value} %',
    es: 'Humedad {value} %',
  },
  pressureText: { en: '{value} hPa', fr: '{value} hPa', de: '{value} hPa', es: '{value} hPa' },
  seriesMeasured: { en: 'Measured', fr: 'Mesuré', de: 'Gemessen', es: 'Medido' },
  seriesForecast: { en: 'Forecast', fr: 'Prévision', de: 'Vorhersage', es: 'Previsión' },
  rowNow: { en: 'Now', fr: 'Maintenant', de: 'Jetzt', es: 'Ahora' },
  rowPeak: {
    en: 'Peak at {time}',
    fr: 'Pic à {time}',
    de: 'Spitze um {time}',
    es: 'Pico a las {time}',
  },
  alertBody: {
    en: 'Air quality {level} expected around {time} (in {hours} h).',
    fr: 'Qualité de l’air {level} attendue vers {time} (dans {hours} h).',
    de: 'Luftqualität {level} gegen {time} erwartet (in {hours} Std.).',
    es: 'Calidad del aire {level} prevista hacia las {time} (en {hours} h).',
  },
  noForecast: {
    en: 'No forecast for this place yet: Airly forecasts only part of its sensors.',
    fr: 'Pas encore de prévision pour ce lieu : Airly ne prévoit que pour une partie de ses capteurs.',
    de: 'Noch keine Vorhersage für diesen Ort: Airly erstellt sie nur für einen Teil seiner Sensoren.',
    es: 'Aún no hay previsión para este lugar: Airly solo la ofrece para parte de sus sensores.',
  },
  noReading: {
    en: 'No measurement yet: the next reading of Airly will fill this widget.',
    fr: 'Pas encore de mesure : la prochaine lecture d’Airly remplira ce widget.',
    de: 'Noch keine Messung: die nächste Lesung von Airly füllt dieses Widget.',
    es: 'Aún no hay medición: la próxima lectura de Airly llenará este widget.',
  },
  noPlaceWidget: {
    en: 'Choose a house or an Airly sensor in the configuration of Airly, then create the device.',
    fr: 'Choisissez une maison ou un capteur Airly dans la configuration d’Airly, puis créez l’appareil.',
    de: 'Wähle in der Konfiguration von Airly ein Haus oder einen Airly-Sensor und lege dann das Gerät an.',
    es: 'Elija una casa o un sensor Airly en la configuración de Airly y luego cree el dispositivo.',
  },
  buttonRefresh: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
  refreshDone: {
    en: 'Read again: CAQI {caqi}.',
    fr: 'Relu : CAQI {caqi}.',
    de: 'Neu gelesen: CAQI {caqi}.',
    es: 'Releído: CAQI {caqi}.',
  },
  refreshCached: {
    en: 'Already up to date: read less than 15 minutes ago (the key has a daily limit).',
    fr: 'Déjà à jour : lu il y a moins de 15 minutes (la clé a une limite quotidienne).',
    de: 'Bereits aktuell: vor weniger als 15 Minuten gelesen (der Schlüssel hat ein Tageslimit).',
    es: 'Ya está al día: leído hace menos de 15 minutos (la clave tiene un límite diario).',
  },
};

/**
 * @description Whether a value is one of the four languages.
 * @param {unknown} value - The value.
 * @returns {boolean} True for en, fr, de, es.
 */
function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/**
 * @description A text in a language, its placeholders filled.
 * @param {string} key - A TEXTS key.
 * @param {string} language - The language (English when unknown).
 * @param {object} [values] - The placeholder values.
 * @returns {string} The text.
 * @example
 * t('refreshDone', 'fr', { caqi: 44 }); // 'Relu : CAQI 44.'
 */
function t(key, language, values = {}) {
  const entry = TEXTS[key];
  if (!entry) {
    return key;
  }
  const template = entry[isLanguage(language) ? language : 'en'] ?? entry.en;
  return template.replace(/\{(\w+)\}/g, (whole, name) =>
    values[name] === undefined || values[name] === null ? '' : String(values[name]),
  );
}

/**
 * @description A text in the four languages.
 * @param {string} key - A TEXTS key.
 * @param {object|Function} [values] - The values, or `(language) => values`.
 * @returns {object} `{ en, fr, de, es }`.
 */
function all(key, values = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      t(key, language, typeof values === 'function' ? values(language) : values),
    ]),
  );
}

/**
 * @description The name of a level, full or short.
 * @param {string|null} level - The level key.
 * @param {string} language - The language.
 * @param {boolean} [short] - The short form (badges, tiles).
 * @returns {string} The name, '' without a level.
 */
const levelText = (level, language, short = false) =>
  level ? t(`${short ? 'short' : 'level'}_${level}`, language) : '';

/**
 * @description The name of a pollutant.
 * @param {string|null} pollutant - The pollutant key.
 * @param {string} language - The language.
 * @returns {string} The name.
 */
const pollutantText = (pollutant, language) =>
  pollutant ? t(`pollutant_${pollutant}`, language) : '';

export { LANGUAGES, TEXTS, isLanguage, t, all, levelText, pollutantText };
