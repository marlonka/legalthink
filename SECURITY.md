# Sicherheit

## Sicherheitsprobleme melden

Sicherheitslücken bitte nicht als öffentliches Issue, Diskussion oder Pull Request melden. Melde sie über [GitHub Private Vulnerability Reporting](https://github.com/marlonka/legalthink/security/advisories/new) (Reiter **Security** → **Report a vulnerability**). Die Meldung ist nur für die Maintainer sichtbar.

Unterstützt werden der aktuelle Stand von `main` und die jeweils letzte [Release](https://github.com/marlonka/legalthink/releases).

Eine Meldung braucht den betroffenen Commit oder die Version, die konkrete Auswirkung und Schritte zum Reproduzieren mit erfundenen Daten. Füge nur den dafür nötigen Code oder Fehlertext hinzu. Keine Mandatsunterlagen, API-Schlüssel, `.env`-Dateien, Datenbanken, vollständigen Providerantworten oder Netzwerk-Mitschnitte teilen.

## Schutzgrenzen

- LegalThink ist ein lokal betriebener Einzelbenutzer-Arbeitsraum. Es gibt keine Benutzerkonten, Mandantentrennung oder Verschlüsselung der lokalen SQLite-Datenbank.
- API-Schlüssel gehören ausschließlich in die Backend-Konfiguration. Wer Zugriff auf Rechner, Datenverzeichnis oder Prozessumgebung hat, kann auf dort gespeicherte Inhalte zugreifen.
- Remote-Zugriff ist standardmäßig gesperrt. Die optionale Token-Konfiguration ersetzt keine Absicherung eines öffentlich erreichbaren Dienstes; Einrichtung und Betrieb sind in der [README](README.md#daten-und-grenzen) und [Architektur](docs/architecture.md) beschrieben.
- Dokumenttexte und Modellausgaben sind nicht vertrauenswürdig. Reproduzierbare Umgehungen der Zugriffskontrollen, ungewollte Datenübermittlung, aktive Dokumentinhalte und falsche Quellenbestätigung sind relevante Sicherheitsfunde.
- Nicht im Geltungsbereich: Angriffe, die bereits Zugriff auf das Benutzerkonto oder das Datenverzeichnis voraussetzen, und Betrieb entgegen der dokumentierten Grenzen, etwa ohne Token im Internet.
