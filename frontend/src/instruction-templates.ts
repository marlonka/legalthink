import type { DemoScenario } from './types';

export const INSTRUCTION_TEMPLATES: Record<DemoScenario, string> = {
  contract: `Prüfe den Vertrag auf wesentliche Risiken und Verhandlungspunkte aus der von mir angegebenen Mandantenperspektive.

Schwerpunkte: Leistungsumfang, Vergütung, Haftung, Laufzeit, Kündigung und das Zusammenspiel mit Anlagen.

Priorisiere konkrete Nachteile, Widersprüche und Regelungslücken. Formuliere passende Klauselvorschläge, soweit die vorhandenen Angaben ausreichen.

Benenne offene Fragen zu Mandantenrolle, Vertragsziel und Verhandlungsspielraum, ohne diese Angaben vorauszusetzen.`,

  compare: `Vergleiche das erste Dokument als Original mit dem zweiten als Gegenentwurf. Konzentriere dich auf Änderungen mit praktischen Folgen für die Beteiligten.

Schwerpunkte: verschobene Pflichten, Vergütung, Haftung, Fristen und Kündigung. Berücksichtige auch Ergänzungen, Streichungen und verschobene Regelungen.

Zeige die jeweiligen Wortlaute und ihre Auswirkungen. Priorisiere die Verhandlungspunkte und schlage bei Bedarf passende Formulierungen vor.

Berücksichtige meine Angaben zur vertretenen Partei und zum Verhandlungsziel; benenne fehlende Angaben als offene Fragen.`,

  chronology: `Erstelle aus den Unterlagen und eingefügten Nachrichten eine Chronologie des Sachverhalts.

Ordne jedem Ereignis Datum oder Zeitraum, Beteiligte und Beleg zu. Unterscheide das geschilderte Ereignis vom Datum des Dokuments und von angekündigten Terminen.

Stelle widersprüchliche Angaben nebeneinander und mache kenntlich, von wem eine Behauptung stammt. Zeige Lücken im Ablauf und fehlende Nachweise.

Fasse die wichtigsten offenen Sachverhaltsfragen für die weitere Mandatsbearbeitung zusammen. Übernimm einen zeitlichen oder thematischen Schwerpunkt, wenn ich ihn angebe.`,

  compliance: `Prüfe die beschriebenen Verarbeitungsvorgänge anhand der Unterlagen und meiner Angaben zum Prüfziel.

Schwerpunkte: Zwecke, betroffene Personen, Datenarten, Rollen, Empfänger und Datenflüsse. Prüfe dazu die erkennbaren Rechtsgrundlagen, Informationen, Speicherfristen und Schutzmaßnahmen.

Ordne konkrete Datenschutzfragen nach Handlungsbedarf. Unterscheide dokumentierte Abläufe von Planungen und offenen Angaben.

Benenne gezielt, welche Informationen oder Nachweise für die weitere Prüfung fehlen. Berücksichtige meine Mandantenrolle, soweit ich sie angebe.`,

  avv: `Prüfe den AVV einschließlich der vorgelegten Anlagen aus der von mir angegebenen Mandantenperspektive.

Schwerpunkte: Leistungs- und Verarbeitungsumfang, Weisungen, Schutzmaßnahmen, Unterauftragnehmer, Datenübermittlungen, Unterstützung, Kontrollen sowie Rückgabe und Löschung.

Zeige konkrete Regelungslücken, Widersprüche zwischen Vertrag und Anlagen sowie Verhandlungspunkte. Schlage geeignete Klauseländerungen vor, soweit die Angaben ausreichen.

Benenne fehlende Anlagen und Angaben zur tatsächlichen Aufgabenverteilung. Setze die Rolle meiner Mandantschaft nicht voraus.`,

  dsfa: `Sichte die Unterlagen zur Vorbereitung einer Datenschutz-Folgenabschätzung für die beschriebene Verarbeitung.

Ordne vorhandene Angaben zu Zwecken und Datenflüssen, Erforderlichkeit und Verhältnismäßigkeit sowie Risiken für betroffene Personen.

Prüfe, welche Schutzmaßnahmen vorgesehen, umgesetzt oder in ihrer Wirkung belegt sind. Benenne verbleibende Risiken und die dafür noch benötigten Informationen.

Fasse zusammen, welche Angaben zur Einschätzung einer DSFA-Pflicht und zur weiteren Bearbeitung fehlen. Berücksichtige den von mir genannten Projektstand und Zuständigkeiten.`,

  advertising: `Prüfe die vorgelegten Werbeaussagen im Zusammenhang mit Produkt, Zielgruppe, Medium und geplanter Veröffentlichung, soweit diese Angaben vorliegen.

Schwerpunkte: Gesamteindruck, konkrete Leistungs- und Preisangaben, Vergleiche, Umwelt- oder Gesundheitsversprechen sowie erkennbare Einschränkungen.

Ordne kritische Aussagen nach Handlungsbedarf. Benenne die benötigten Nachweise oder fehlenden Informationen und schlage sachlich gedeckte Textalternativen vor, soweit möglich.

Berücksichtige meine Angaben zu Zielmarkt und Prüfziel; ergänze fehlende Tatsachen nicht durch Annahmen.`,
};
