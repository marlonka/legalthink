# UI-Texte

- Schreibe funktionale Produkttexte. Jeder sichtbare Text muss eine Aktion benennen, einen relevanten Zustand erklären oder eine Entscheidung ermöglichen.
- Keine Slogans, Markenpoesie, abstrakten Nutzenversprechen, künstlichen Dreierformeln oder motivierenden und beruhigenden Floskeln in Arbeitsoberflächen.
- Keine dekorativen Eyebrows, Hero-Texte, Profilattrappen oder wiederholten Beschriftungen. Freien Platz nicht mit Text füllen.
- Keine Selbstverständlichkeiten wie „Die Entscheidung liegt bei Ihnen“. Hinweise nur dort zeigen, wo ihre konkrete Konsequenz relevant ist; ausführliche Erklärungen bei Bedarf aufklappen.
- Keine unbelegten Qualitäts-, Sicherheits- oder Rechtsversprechen. Sachliche Einschränkungen präzise und ohne wiederholte Disclaimer nennen.
- Leere Zustände nennen den fehlenden Inhalt. Eine nächste Aktion nur anbieten, wenn sie nicht bereits direkt sichtbar ist.
- Vor jedem neuen Text prüfen: Ändert er die Handlung oder Entscheidung des Nutzers? Wenn nicht, streichen. Nicht durch eine elegantere Floskel ersetzen.

Verbotene Muster: „Mehr Klarheit. Für Ihr nächstes Argument.“, „Raum für gutes Urteil.“, „Ihre Standards. Immer dabei.“, „Dokumente verstehen. Risiken einordnen. Entscheidungen vorbereiten.“

# Prüfung und Auslieferung

- Bei Änderungen an der Oberfläche zuerst `design.md` lesen. Farben, Flächen, Abstände und Zustände aus dem dort beschriebenen Designsystem verwenden; beide Themes über gemeinsame semantische Tokens gestalten.
- Ausnahme auf ausdrücklichen Nutzerwunsch: Die Dokumentvorschau fährt beim Öffnen von rechts ein. Ihre endgültige Breite wird sofort reserviert; Quellenwechsel animieren weder Aufteilung noch Dokumentrahmen. Reduced Motion öffnet sie ohne Bewegung. Einzelheiten in `design.md`.
- Bedienflächen und Text bleiben beim Drücken, Auswählen und Laden positions- und größenstabil. Keine Skalierung oder Verschiebung von Buttons, Seiten, Menüs oder Dialogen als Klickfeedback. Wechselnde Beschriftungen brauchen reservierte Breite, Scrollbereiche stabile Scrollbalkenbreite. Neue Interaktionen mit Positionsmessungen über mehrere Frames prüfen; ein bestandener Funktionstest allein belegt keine Layoutstabilität.

- Vorhandene Bedienabläufe und Barrierefreiheit bei Text- und Layoutänderungen erhalten. Desktop und Mobilansicht prüfen.
- Keine echten OpenAI-Anfragen in Entwicklung oder Tests, sofern Marlon sie nicht ausdrücklich freigibt.
- Für freigegebene echte Modelltests ausschließlich `gpt-6-luna` mit `high` verwenden. Standardauswahl der Anwendung ist ebenfalls Luna/Hoch.
- Änderungen mit Conventional Commit committen und pushen.
