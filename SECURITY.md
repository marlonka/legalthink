# Sicherheit

## Sicherheitsprobleme melden

Dieses Repository ist derzeit privat. Mitarbeitende mit Zugriff melden Sicherheitsprobleme als Issue an Maintainer Marlon Kaulich. Issues sind für Personen mit Repository-Zugriff sichtbar; sie sind kein Ablageort für vertrauliche Nutzdaten.

Eine Meldung braucht den betroffenen Commit, die konkrete Auswirkung und Schritte zum Reproduzieren mit erfundenen Daten. Füge nur den dafür nötigen Code oder Fehlertext hinzu. Keine Mandatsunterlagen, API-Schlüssel, `.env`-Dateien, Datenbanken, vollständigen Providerantworten oder Netzwerk-Mitschnitte teilen.

Vor einer öffentlichen Freigabe des Repositorys muss ein privater Meldeweg eingerichtet und hier verlinkt werden. Sicherheitsfunde dürfen dann nicht als öffentliche Issues oder Pull Requests gemeldet werden.

## Schutzgrenzen

- LegalThink ist ein lokal betriebener Einzelbenutzer-Arbeitsraum. Es gibt keine Benutzerkonten, Mandantentrennung oder Verschlüsselung der lokalen SQLite-Datenbank.
- API-Schlüssel gehören ausschließlich in die Backend-Konfiguration. Wer Zugriff auf Rechner, Datenverzeichnis oder Prozessumgebung hat, kann auf dort gespeicherte Inhalte zugreifen.
- Remote-Zugriff ist standardmäßig gesperrt. Die optionale Token-Konfiguration ersetzt keine Absicherung eines öffentlich erreichbaren Dienstes; Einrichtung und Betrieb sind in der [README](README.md#daten-und-grenzen) und [Architektur](docs/architecture.md) beschrieben.
- Dokumenttexte und Modellausgaben sind nicht vertrauenswürdig. Reproduzierbare Umgehungen der Zugriffskontrollen, ungewollte Datenübermittlung, aktive Dokumentinhalte und falsche Quellenbestätigung sind relevante Sicherheitsfunde.

Entwicklung und Prüfungen verwenden synthetische Daten. Echte OpenAI-Aufrufe benötigen eine ausdrückliche Freigabe; siehe [CONTRIBUTING.md](CONTRIBUTING.md).
