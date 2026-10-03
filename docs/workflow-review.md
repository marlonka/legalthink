# Prüfung der Arbeitsabläufe

3. Oktober 2026. Perspektiven: anwaltliche Arbeit, funktionale Texte, Interaktion und technische Zustandsführung. Geprüft wurden die lokale Oberfläche, Eingaben und vorgegebene synthetische Ergebnisse. Keine echte Modellanalyse.

## Korrigierte Probleme

- „Beispiel öffnen“ führte unabhängig von der Aufgabe zur Vertragsprüfung. Es gibt jetzt sieben zugeordnete Beispiele.
- AVV/DSFA fügten Anweisungen in den Prüfauftrag ein; diese blieben beim Wechsel zu Werbung stehen. Die Aufgabe wird jetzt gesondert gewählt und übermittelt. Eingaben und Dokumente bleiben je Aufgabe getrennt.
- Nach dem Entfernen des Originals konnte der Gegenentwurf dessen Rolle übernehmen. Zwei feste Plätze erhalten die Zuordnung beim Ersetzen und Tauschen.
- „Formulierung“ wechselte nur den Tab. Die Aktion zeigt und fokussiert jetzt den zugehörigen Vorschlag.
- Chronologiebelege hatten keinen direkten Weg zum Dokumentkontext. Die Fundstellenaktion öffnet ihn und stellt beim Schließen den Fokus am Ereignis wieder her.

## Geprüfte Aufgaben

| Schritt | Eingabe und Beispiel | Entscheidender Bedienpunkt |
| --- | --- | --- |
| 1. Vertrag | Optional Mandantenrolle und Schwerpunkt; Cloud-Vertrag mit Haftung, Export und Verfügbarkeit | Befund, Wortlaut und Vorschlag getrennt; Formulierung direkt erreichbar |
| 2. Vergleich | Genau zwei Fassungen; Cloud-Vertrag vor und nach Gegenentwurf | Original/Gegenentwurf bleiben beim Entfernen, Ersetzen, Tauschen und im gespeicherten Ergebnis erkennbar |
| 3. Chronologie | Mehrere Unterlagen; Rechnerbestellung, E-Mail und Wareneingangsnotiz | Zeittafel zuerst; Ereignis, Beleg und offene Frage getrennt; Zugang und Rechtswirkung der Lieferbitte bleiben offen |
| 4. Datenschutz allgemein | Angaben zu Verarbeitung, Rollen und offenen Punkten; Kundenportal | Keine automatische Annahme, dass jeder Dienstleister Auftragsverarbeiter ist |
| 5. AVV | AVV und Anlagen; Unterauftragnehmer, Löschung und technische Maßnahmen | Mandantenrolle wird nicht aus dem Platzhalter übernommen; Änderungsbedarf und fehlende Angaben getrennt |
| 6. DSFA | Geplante Verarbeitung und Maßnahmen; Videoanalyse im Lager | Vorbereitung mit offenen Angaben; geplante Wirkung wird nicht als nachgewiesen behandelt |
| 7. Werbung | Aussage, Medium, Zielgruppe und Nachweise; Reinigungsmittel | Zwei unbelegte Werbeversprechen, keine doppelten Befunde und keine frei erfundenen Ersatzversprechen |

## Zustände und Umfang

- Luna/Hoch ist der Code-Standard im Frontend und Backend, auch bei eigener Installation. Eine bewusste Modellauswahl bleibt im betreffenden Browser gespeichert; sie ändert andere Browserprofile nicht.
- Der Prüfauftrag ist optional. Workflow und Datenschutz-Aufgabe bestimmen die Prüfanweisungen im Backend. Platzhalter sind Beispiele und werden nicht mitgeschickt.
- Dokumente, Prüfauftrag, Playbook und Rechercheeinstellung bleiben je Aufgabe während der geöffneten Sitzung erhalten. Neuladen setzt diese Entwürfe zurück.
- Ein Beispiel verändert keinen eigenen Entwurf und benötigt keinen API-Schlüssel. Die Beispielfälle verwenden ausschließlich synthetische Dokumente und vorgegebene Ergebnisse.
- Versionsvergleich liefert Befunde und Formulierungsvorschläge. Er ist keine vollständige Wort-für-Wort-Synopse. DSFA liefert Vorbereitung, keinen abgeschlossenen DSFA-Bericht.

## Nachweise

Die Browserläufe speichern neue Start- und Ergebnisaufnahmen für alle sieben Schritte unter `artifacts/workflow-audit/`. Diese lokalen Prüfdateien werden nicht eingecheckt. Die Aufnahmen wurden visuell geprüft, einschließlich Datenschutz bei 390 px in heller und dunkler Darstellung. Die initialen Probleme wurden vorher im Browser nachvollzogen.

Die damaligen Browserprüfungen wurden am 3. Oktober 2026 entfernt. Erhalten bleiben ein Start-/Exporttest sowie Backendprüfungen für Datenspeicherung, Quellenzuordnung und die OpenAI-Anbindung. Aktueller Umfang und Grenzen: [Prüfprotokoll](validation.md).

Diese Prüfung belegt Bedienverhalten und deterministische Anwendungseigenschaften. Rechtliche Ergebnisqualität, reale Modellantworten, Recherche und Kosten bleiben Gegenstand späterer freigegebener Tests mit Luna/Hoch.
