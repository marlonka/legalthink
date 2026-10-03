# Rechtliche Prüfung vor einer Veröffentlichung

Stand: 3. Oktober 2026. Geprüft wurden Anwendung, README, Lizenzbestand und die unten verlinkten Primärquellen. Dies ist eine technische und dokumentarische Bestandsaufnahme, keine anwaltliche Freigabe. Verträge, Rechteinhaberschaft und konkrete Mandate wurden nicht geprüft.

## Ergebnis

Ein Hinweis „auf eigene Verantwortung“ verhindert weder Ansprüche noch Klagen. Der eigene Projektcode erhält auf Entscheidung des Projektinhabers die MIT-Lizenz. Die sichtbare Anwendung heißt künftig „LegalThink“. Vor einer Veröffentlichung bleiben insbesondere **Namensrechte und Rechte an Beiträgen** zu klären; eine rechtliche Freigabe folgt daraus nicht.

| Befund | Maßnahme / verbleibende Entscheidung |
| --- | --- |
| Der bisherige Name „LegalThinkGPT“ enthält „GPT“. OpenAI untersagt die Verwendung dieser Marke in eigenen Produktnamen. | Anwendung, Pakete und Repository heißen „LegalThink“ beziehungsweise `legalthink`. Vorhandene Browserpräferenzen bleiben erhalten. Die [Namensvorprüfung](name-check.md) dokumentiert Registerabfragen und gleichnamige Rechtsanbieter; eine Markenfreigabe bleibt offen. [OpenAI-Markenrichtlinien](https://openai.com/brand/) |
| Keine Lizenz für den eigenen Projektcode vorhanden. | Unveränderte [MIT-Lizenz](../LICENSE) mit Copyright „2026 Marlon Kaulich“ ergänzt. Herkunft und Nutzungsrechte aller Beiträge, Grafiken und übernommenen Texte bleiben vor Veröffentlichung zu prüfen. |
| Lizenzhinweise von Frontend-Bibliotheken fehlten teilweise im Build. | Der Build liefert vollständige Hinweise unter `/third-party-licenses.txt`; PDF-Ressourcen behalten zusätzlich ihre jeweiligen Lizenzdateien. Python-Pakete behalten die Lizenzdateien ihrer Distributionen. Bei eigenen Installationspaketen/Containern müssen diese mitgeliefert werden. |
| Nutzer konnten Verantwortung für eingegebene Daten und Ergebnisverwendung nur aus verstreuten Hinweisen erkennen. | Einstellungen und README benennen Übermittlungsberechtigung, Verschwiegenheit, Datenschutz, Betriebsschutz und eigene Ergebnisprüfung. Diese Informationen sind kein pauschaler Haftungsausschluss. |
| Einzelbenutzer-Anwendung ohne Benutzeranmeldung oder Datenbankverschlüsselung. | Keine ungeschützte Internetfreigabe. Mehrbenutzerbetrieb und gehostetes Angebot benötigen eine gesonderte technische und rechtliche Prüfung. |

## Haftung und Lizenz

Der eigene Projektcode steht unter der unveränderten MIT-Lizenz. Ihre Erlaubnis zur Nutzung und Weitergabe ist von der Wirksamkeit einzelner Haftungsklauseln zu unterscheiden. Keine selbst formulierte Zusage „unter keinen Umständen haftbar“ ergänzen.

Vorsatz lässt sich nach [§ 276 Abs. 3 BGB](https://www.gesetze-im-internet.de/bgb/__276.html) nicht im Voraus ausschließen. Vorformulierte Bedingungen unterliegen je nach Vertragsverhältnis der Inhaltskontrolle; maßgeblich sind insbesondere [§ 307 BGB](https://www.gesetze-im-internet.de/bgb/__307.html), [§ 309 BGB](https://www.gesetze-im-internet.de/bgb/__309.html) und der unterschiedliche Anwendungsbereich nach [§ 310 BGB](https://www.gesetze-im-internet.de/bgb/__310.html). Eine kostenlose Bereitstellung oder Open-Source-Lizenz bedeutet deshalb keine pauschale Haftungsfreiheit. Vor Veröffentlichung Lizenz und begleitende Aussagen anwaltlich auf das konkrete Vertriebsmodell prüfen lassen.

## Mandatsdaten und OpenAI

Betreiber müssen vor Nutzung bestimmen, welche Inhalte sie auf welcher Grundlage weitergeben dürfen. Für anwaltliche Geheimnisse sind insbesondere [§ 203 StGB](https://www.gesetze-im-internet.de/stgb/__203.html) und [§ 43e BRAO](https://www.gesetze-im-internet.de/brao/__43e.html) relevant: erforderlicher Zugriff, Auswahl und Verschwiegenheitsbindung von Dienstleistern, weitere Mitwirkende und Auslandsverarbeitung. Bei unmittelbar auf ein einzelnes Mandat bezogenen Dienstleistungen ist auch die Einwilligungsregel des § 43e Abs. 5 BRAO zu prüfen. Eine allgemeine Einstellungsnotiz erledigt diese Anforderungen nicht.

Bei personenbezogenen Daten sind unter anderem Rechtsgrundlage, Datenminimierung, gegebenenfalls besondere Datenkategorien, Auftragsverarbeitung, Sicherheit und Drittlandtransfers zu prüfen: [DSGVO, Art. 5, 6, 9, 28, 32 und 44 ff.](https://eur-lex.europa.eu/legal-content/DE-EN/TXT/?uri=CELEX:32016R0679). Lokaler Betrieb ändert nichts an der Übermittlung bei einer gestarteten Analyse. EU-Endpoint und `store=false` allein belegen keine rechtmäßige Verarbeitung.

Die [OpenAI-Vertragsbedingungen](https://openai.com/policies/services-agreement/) ordnen dem API-Kunden insbesondere die notwendigen Rechte an Eingaben und die Bewertung der Ausgaben zu. Maßgeblich bleiben die eigenen Verträge und [OpenAI-Datenkontrollen](https://developers.openai.com/api/docs/guides/your-data). Die App bestätigt weder Vertragsabschluss noch Projektfreigaben. Webrecherche kann aus Unterlagen abgeleitete Suchanfragen erzeugen; ihre Zulässigkeit ist mitzuprüfen.

## Grenzen dieser Prüfung

- Die ergänzte [Namensvorprüfung](name-check.md) umfasst eine konkrete Zeichenfolge in drei Registern. Keine vollständige Ähnlichkeitsrecherche oder Prüfung des LT-Zeichens; die Eigenzeichnung beweist keine Rechtefreiheit.
- Keine vollständige Prüfung der Rechtekette früherer Beiträge, Referenzen und KI-generierter Bestandteile.
- Keine Freigabe eines gehosteten oder kostenpflichtigen Angebots. Anbieterpflichten, Datenschutzhinweise, Vertragsgestaltung und eine mögliche Einordnung nach RDG und KI-Verordnung hängen vom tatsächlichen Angebot und Einsatz ab.
- Keine Zertifizierung der Ausgabequalität. Zitatabgleich bestätigt Textfundstellen; Rechtslage, Tatsachen, Fristen und Handlungsempfehlungen müssen fachlich geprüft werden.

Die Nutzungshinweise dokumentieren Grenzen und Zuständigkeiten. Sie ersetzen keine technischen Schutzmaßnahmen oder projektbezogenen Verträge.
