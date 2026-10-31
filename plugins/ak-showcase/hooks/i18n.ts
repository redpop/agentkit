import type { EngineInterface } from 'claude-code'

/** The languages the texts come in. */
export type Lang = 'en' | 'de'

// Claude Code's `language` setting names a language in words (`German`, `Deutsch`) or by its code
// (`de`); LC_ALL, LC_MESSAGES and LANG carry a locale (`de_DE.UTF-8`).
const GERMAN = /^(de$|de[_-]|german|deutsch)/i

/** German when the first of `values` that is set names it, else English. */
export const languageOf = (values: readonly unknown[]): Lang => {
  const first = values.find((value): value is string => typeof value === 'string' && value.trim() !== '')

  return first !== undefined && GERMAN.test(first.trim()) ? 'de' : 'en'
}

/**
 * The language of this session's texts: Claude Code's `language` setting, else LC_ALL, LC_MESSAGES
 * or LANG, else English. Not the system's: on macOS the runtime reports en-US whatever the system
 * is set to. A read that fails counts as unset.
 */
async function detect($: EngineInterface): Promise<Lang> {
  const setting = await $.config.list().then(
    rows => rows.find(row => row.key === 'language')?.value,
    () => undefined,
  )
  // Each name written out: the hooks loader lists the variables a module reads.
  const locales = await Promise.all([
    $.env.get('LC_ALL').catch(() => undefined),
    $.env.get('LC_MESSAGES').catch(() => undefined),
    $.env.get('LANG').catch(() => undefined),
  ])

  return languageOf([setting, ...locales])
}

// The language read for this load of the module; read again at each session start.
let language: Promise<Lang> | undefined

// Function declarations, not arrows: past an import the hooks loader follows `$` only into those.

/** Reads the language afresh, at a session start. */
export function learnLanguage($: EngineInterface): Promise<Lang> {
  language = detect($)

  return language
}

/** The language as last read, read now when this load of the module has not yet. */
export function languageFor($: EngineInterface): Promise<Lang> {
  return language ?? learnLanguage($)
}

const EN = {
  title: 'Showcase',
  summary: 'A style guide in a pane: every element, prop and variant a mod can draw.',
  details:
    'Turning it on opens a pane with eleven sections: text, colours, spacing, layout, hover, ' +
    'buttons, forms, content, graphics, the band segment and feedback. Each sample names the prop ' +
    'that draws it and what does not exist. Its controls only record that they were used: they ' +
    'send no prompt, run no command or tool and touch no file. /showcase opens the pane.',
  command: 'Open the style guide pane, or /showcase tone <ok|warn|alert|info|dim> for the demo segment',
  usage: 'Usage: /showcase [tone ok|warn|alert|info|dim]',
  opened: 'Showcase opened.',
  toneSet: (tone: string) => `Demo segment tone: ${tone}`,
  open: 'open',
  section: 'Section',
  last: 'Last action',
  none: 'none yet',
  missing: 'Not available',
  note: 'Note',
  noSurface: (what: string, surface: string) => `${what}: not drawn on ${surface}.`,
  sections: {
    text: 'Text',
    colors: 'Colours',
    spacing: 'Spacing',
    layout: 'Layout and borders',
    hover: 'Hover',
    buttons: 'Buttons',
    forms: 'Forms',
    content: 'Content',
    graphics: 'Graphics',
    band: 'Band segment',
    feedback: 'Feedback',
  },
  text: {
    sizes: 'Sizes (size)',
    weights: 'Weights (weight)',
    styles: 'Styles',
    wrap: 'Long lines (wrap)',
    sample: 'The quick brown fox jumps over the lazy dog',
    long: 'A line that is far too long for a narrow pane, so that each wrap mode shows what it does with the rest of the sentence.',
    missing: 'No font family, no size in pixels, no line height, no letter spacing. A link inside running text needs Markdown.',
  },
  colors: {
    theme: 'Theme keys (color)',
    background: 'Backgrounds (backgroundColor)',
    raw: 'Raw colours: a name or hex, fixed in light and dark',
    desktopNote: 'The desktop app paints theme keys in its own palette: inactive, subtle, suggestion, remember, permission and ide all come out grey, the dimmed diff keys barely show, and inverseText needs a dark ground.',
    missing: 'No gradients, no opacity, no own theme.',
  },
  spacing: {
    gap: 'Gap between children (gap)',
    padding: 'Padding inside a border (padding)',
    note: 'Steps xs to xl: the terminal and VS Code count cells (across xs/sm 1, md 2, lg 3, xl 4), desktop and mobile use their own scale. A number is cells everywhere.',
    missing: 'No pixels, no percent spacing.',
  },
  layout: {
    direction: 'Direction (flexDirection)',
    justify: 'Main axis (justifyContent)',
    align: 'Cross axis (alignItems)',
    borders: 'Borders (borderStyle, borderColor)',
    card: 'Card: border and padding',
    cardText: 'A card is a Box with a border and padding. A backgroundColor such as subtle draws dark under black text on the desktop app.',
    desktopNote: 'The desktop app draws every borderStyle as the same thin rounded frame; only borderColor changes it.',
    missing: 'No grid, no shadow, no rounded corners beyond borderStyle "round", no z-index.',
  },
  hover: {
    box: 'Box: the border changes under the pointer',
    text: 'Text: colour and weight change under the pointer',
    row: 'A keyed Box: every Text in it reacts when the row is hovered',
    hoverMe: 'Point at me',
    note: 'Hover needs a Box with a key around it (or a scope): that Box is what the pointer hovers. It is drawing only: no hook runs, nothing reaches the mod. The terminal has no pointer.',
    missing: 'No tooltip on Box, Text or Button. A tooltip exists only as <title> in an interactive Svg.',
  },
  buttons: {
    plainHotkey: 'plain with hotkey: drawn as "1: Yes", pressed by key while the pane has focus',
    children: 'Text children: a chip with a dim part',
    glyph: 'One glyph as label: a control by itself',
    note: 'The desktop app draws only the label: children lose their colour and weight there. secondary looks like the default, and role="dismiss" inside a pane is a plain button.',
    missing: 'No colour of your own, no icon beside a label, no disabled state, no size, no tooltip.',
  },
  forms: {
    single: 'Input, one line',
    multi: 'Input, several lines (rows)',
    select: 'Select: one of several',
    toggle: 'Toggle, built from two Buttons',
    toggleSelect: 'Toggle, built from a Select',
    typed: 'Typed',
    picked: 'Picked',
    placeholder: 'Type something and press Enter',
    send: 'Keep',
    name: 'Name',
    fruit: 'Fruit',
    fruits: [
      { value: 'apple', label: 'Apple' },
      { value: 'pear', label: 'Pear' },
      { value: 'plum', label: 'Plum' },
    ],
    on: 'On',
    off: 'Off',
    mobile: 'The mobile app draws no Input and no Select.',
    missing: 'No checkbox, no radio group (Select is one), no slider, no date picker, no validation state, no disabled field.',
  },
  content: {
    code: 'Code: source with line numbers',
    diff: 'Code: format="diff"',
    markdown: 'Markdown',
    link: 'Link: opens the browser for real',
    linkNote: 'The Markdown link here goes to onLinkPress (pressableLinks), so pressing it opens nothing.',
    missing: 'No tables inside Text, no collapsible block. The copy button on Code is the desktop app\'s own: no prop turns it on or off.',
  },
  graphics: {
    still: 'Svg as an image',
    live: 'Svg with isInteractive: CSS :hover, animation and a <title> tooltip',
    tip: 'A tooltip from <title>',
    terminal: 'The terminal draws no Svg. It alone has Raster and Image, which this pane leaves out.',
    missing: 'No script in an Svg, no press on a part of it (a press belongs on the Box around it), at most 131,072 characters.',
  },
  band: {
    intro: 'The shared band above the prompt shows this mod as one segment while it is on. It carries every part a segment can have:',
    parts: [
      'text: the plain line the terminal draws',
      'parts: the line in runs, each with its own tone',
      'rich: the desktop line, with a ring (0–100) and a line icon (id, copy, check)',
      'compact: the short form when the band runs out of room',
      'card: label and value rows in the Mods pane',
      'settings: a picker in the Mods pane that runs /showcase tone …',
      'button: one action, here "open"',
      'tone and priority',
    ],
    tone: 'Tone of the demo segment',
    unswitched: 'ak-mods does not switch this mod, so it draws its own band instead of a segment.',
    missing: 'One segment per mod, one line, at most one button. No own colours: ak-mods picks them per tone.',
  },
  feedback: {
    toast: 'Show a toast',
    status: 'Set the status line',
    clear: 'Clear the status line',
    toastText: 'A toast from the showcase',
    statusText: 'Showcase: status line',
    note: 'These three really show something, but trigger nothing else.',
    missing: 'No modal dialog, no progress bar element (use a ring, Svg or Text), no badge.',
  },
}

const DE: typeof EN = {
  title: 'Showcase',
  summary: 'Ein Styleguide im Pane: jedes Element, jede Prop und Variante, die ein Mod zeichnen kann.',
  details:
    'Eingeschaltet öffnet er ein Pane mit elf Abschnitten: Text, Farben, Abstände, Layout, Hover, ' +
    'Buttons, Formulare, Inhalte, Grafik, das Band-Segment und Rückmeldungen. Jedes Beispiel nennt ' +
    'die Prop, die es zeichnet, und was es nicht gibt. Seine Bedienelemente halten nur fest, dass ' +
    'sie benutzt wurden: kein Prompt, kein Befehl, kein Tool, keine Datei. /showcase öffnet das Pane.',
  command: 'Das Styleguide-Pane öffnen, oder /showcase tone <ok|warn|alert|info|dim> für das Demo-Segment',
  usage: 'Aufruf: /showcase [tone ok|warn|alert|info|dim]',
  opened: 'Showcase geöffnet.',
  toneSet: (tone: string) => `Ton des Demo-Segments: ${tone}`,
  open: 'öffnen',
  section: 'Abschnitt',
  last: 'Letzte Aktion',
  none: 'noch keine',
  missing: 'Gibt es nicht',
  note: 'Hinweis',
  noSurface: (what: string, surface: string) => `${what}: auf ${surface} nicht gezeichnet.`,
  sections: {
    text: 'Text',
    colors: 'Farben',
    spacing: 'Abstände',
    layout: 'Layout und Rahmen',
    hover: 'Hover',
    buttons: 'Buttons',
    forms: 'Formulare',
    content: 'Inhalte',
    graphics: 'Grafik',
    band: 'Band-Segment',
    feedback: 'Rückmeldungen',
  },
  text: {
    sizes: 'Größen (size)',
    weights: 'Stärken (weight)',
    styles: 'Auszeichnungen',
    wrap: 'Lange Zeilen (wrap)',
    sample: 'Franz jagt im komplett verwahrlosten Taxi quer durch Bayern',
    long: 'Eine Zeile, die für ein schmales Pane viel zu lang ist, damit jede Umbruchart zeigt, was sie mit dem Rest des Satzes macht.',
    missing: 'Keine Schriftart, keine Größe in Pixeln, keine Zeilenhöhe, kein Zeichenabstand. Ein Link im Fließtext braucht Markdown.',
  },
  colors: {
    theme: 'Theme-Schlüssel (color)',
    background: 'Hintergründe (backgroundColor)',
    raw: 'Feste Farben: Name oder Hex, in Hell und Dunkel gleich',
    desktopNote: 'Die Desktop-App malt Theme-Schlüssel in ihrer eigenen Palette: inactive, subtle, suggestion, remember, permission und ide werden alle grau, die gedimmten diff-Schlüssel sind kaum sichtbar, und inverseText braucht einen dunklen Grund.',
    missing: 'Keine Verläufe, keine Deckkraft, kein eigenes Theme.',
  },
  spacing: {
    gap: 'Abstand zwischen Kindern (gap)',
    padding: 'Innenabstand im Rahmen (padding)',
    note: 'Stufen xs bis xl: Terminal und VS Code zählen Zellen (quer xs/sm 1, md 2, lg 3, xl 4), Desktop und Mobile haben eine eigene Skala. Eine Zahl ist überall Zellen.',
    missing: 'Keine Pixel, keine Prozent-Abstände.',
  },
  layout: {
    direction: 'Richtung (flexDirection)',
    justify: 'Hauptachse (justifyContent)',
    align: 'Querachse (alignItems)',
    borders: 'Rahmen (borderStyle, borderColor)',
    card: 'Karte: Rahmen und Innenabstand',
    cardText: 'Eine Karte ist eine Box mit Rahmen und Innenabstand. Ein backgroundColor wie subtle wird in der Desktop-App dunkel unter schwarzem Text.',
    desktopNote: 'Die Desktop-App zeichnet jeden borderStyle als denselben dünnen, abgerundeten Rahmen; nur borderColor ändert ihn.',
    missing: 'Kein Grid, kein Schatten, keine runden Ecken außer borderStyle "round", kein z-index.',
  },
  hover: {
    box: 'Box: der Rahmen ändert sich unter dem Zeiger',
    text: 'Text: Farbe und Stärke ändern sich unter dem Zeiger',
    row: 'Eine Box mit key: jeder Text darin reagiert, wenn die Zeile berührt wird',
    hoverMe: 'Zeig auf mich',
    note: 'Hover braucht eine Box mit key drumherum (oder einen scope): diese Box ist es, die der Zeiger berührt. Reine Optik: kein Hook läuft, nichts erreicht den Mod. Das Terminal hat keinen Zeiger.',
    missing: 'Kein Tooltip an Box, Text oder Button. Einen Tooltip gibt es nur als <title> in einem interaktiven Svg.',
  },
  buttons: {
    plainHotkey: 'plain mit hotkey: gezeichnet als "1: Ja", per Taste gedrückt, solange das Pane den Fokus hat',
    children: 'Text-Kinder: ein Chip mit dimmem Teil',
    glyph: 'Ein Zeichen als Label: ein eigenes Bedienelement',
    note: 'Die Desktop-App zeichnet nur das Label: Kinder verlieren dort Farbe und Stärke. secondary sieht aus wie der Standard, und role="dismiss" ist im Pane ein normaler Button.',
    missing: 'Keine eigene Farbe, kein Icon neben dem Label, kein deaktivierter Zustand, keine Größe, kein Tooltip.',
  },
  forms: {
    single: 'Input, einzeilig',
    multi: 'Input, mehrzeilig (rows)',
    select: 'Select: eins aus mehreren',
    toggle: 'Toggle, aus zwei Buttons gebaut',
    toggleSelect: 'Toggle, aus einem Select gebaut',
    typed: 'Eingegeben',
    picked: 'Gewählt',
    placeholder: 'Etwas tippen und Enter drücken',
    send: 'Übernehmen',
    name: 'Name',
    fruit: 'Obst',
    fruits: [
      { value: 'apple', label: 'Apfel' },
      { value: 'pear', label: 'Birne' },
      { value: 'plum', label: 'Pflaume' },
    ],
    on: 'An',
    off: 'Aus',
    mobile: 'Die Mobile-App zeichnet kein Input und kein Select.',
    missing: 'Keine Checkbox, keine Radio-Gruppe (Select ist eine), kein Slider, keine Datumsauswahl, kein Fehlerzustand, kein deaktiviertes Feld.',
  },
  content: {
    code: 'Code: Quelltext mit Zeilennummern',
    diff: 'Code: format="diff"',
    markdown: 'Markdown',
    link: 'Link: öffnet wirklich den Browser',
    linkNote: 'Der Markdown-Link hier geht an onLinkPress (pressableLinks), ein Druck öffnet also nichts.',
    missing: 'Keine Tabellen in Text, kein aufklappbarer Block. Den Kopier-Button an Code setzt die Desktop-App selbst: keine Prop schaltet ihn.',
  },
  graphics: {
    still: 'Svg als Bild',
    live: 'Svg mit isInteractive: CSS :hover, Animation und ein <title>-Tooltip',
    tip: 'Ein Tooltip aus <title>',
    terminal: 'Das Terminal zeichnet kein Svg. Nur dort gibt es Raster und Image; dieses Pane lässt sie aus.',
    missing: 'Kein Skript im Svg, kein Druck auf einen Teil davon (ein Druck gehört an die Box drumherum), höchstens 131.072 Zeichen.',
  },
  band: {
    intro: 'Das gemeinsame Band über der Eingabe zeigt diesen Mod als ein Segment, solange er an ist. Es trägt jeden Teil, den ein Segment haben kann:',
    parts: [
      'text: die einfache Zeile, die das Terminal zeichnet',
      'parts: die Zeile in Abschnitten, jeder mit eigenem Ton',
      'rich: die Desktop-Zeile, mit Ring (0–100) und Linien-Icon (id, copy, check)',
      'compact: die Kurzform, wenn dem Band der Platz ausgeht',
      'card: Zeilen aus Label und Wert im Mods-Pane',
      'settings: eine Auswahl im Mods-Pane, die /showcase tone … ausführt',
      'button: eine Aktion, hier "öffnen"',
      'tone und priority',
    ],
    tone: 'Ton des Demo-Segments',
    unswitched: 'ak-mods schaltet diesen Mod nicht, also zeichnet er statt eines Segments sein eigenes Band.',
    missing: 'Ein Segment pro Mod, eine Zeile, höchstens ein Button. Keine eigenen Farben: ak-mods wählt sie je Ton.',
  },
  feedback: {
    toast: 'Toast zeigen',
    status: 'Statuszeile setzen',
    clear: 'Statuszeile leeren',
    toastText: 'Ein Toast aus dem Showcase',
    statusText: 'Showcase: Statuszeile',
    note: 'Diese drei zeigen wirklich etwas, lösen sonst aber nichts aus.',
    missing: 'Kein modaler Dialog, kein Fortschrittsbalken als Element (Ring, Svg oder Text nehmen), kein Badge.',
  },
}

/** The texts of ak-showcase in a language. */
export const texts = (lang: Lang): typeof EN => (lang === 'de' ? DE : EN)

/** The texts as a section reads them. */
export type Texts = typeof EN
