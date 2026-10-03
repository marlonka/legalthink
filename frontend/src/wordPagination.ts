function withoutId<T extends HTMLElement>(element: T): T {
  element.removeAttribute('id');
  return element;
}

// Split only at whitespace: a citation split between pages still has exactly
// the same words and whitespace-normalised text as the source paragraph.
function splitParagraph(paragraph: HTMLElement, fits: () => boolean) {
  const doc = paragraph.ownerDocument;
  const walker = doc.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT);
  const boundaries: { node: Text; offset: number }[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (const match of node.data.matchAll(/\s+/g)) {
      boundaries.push({ node, offset: match.index + match[0].length });
    }
  }
  const range = doc.createRange();
  const candidate = withoutId(paragraph.cloneNode(false) as HTMLElement);
  paragraph.replaceWith(candidate);
  let low = 0;
  let high = boundaries.length - 1;
  let best = -1;
  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const boundary = boundaries[middle];
    range.selectNodeContents(paragraph);
    range.setEnd(boundary.node, boundary.offset);
    candidate.replaceChildren(range.cloneContents());
    if (fits()) {
      best = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  if (best < 0) {
    candidate.replaceWith(paragraph);
    return null;
  }
  const boundary = boundaries[best];
  range.selectNodeContents(paragraph);
  range.setEnd(boundary.node, boundary.offset);
  candidate.replaceChildren(range.cloneContents());
  range.selectNodeContents(paragraph);
  range.setStart(boundary.node, boundary.offset);
  const remainder = withoutId(paragraph.cloneNode(false) as HTMLElement);
  remainder.append(range.cloneContents());
  if (!remainder.textContent?.trim() && !remainder.querySelector('img, br')) {
    candidate.replaceWith(paragraph);
    return null;
  }
  candidate.style.marginBottom = '0';
  remainder.style.marginTop = '0';
  // A continuation is still the same list item, not a new numbered paragraph.
  if (/docx-num-/.test(remainder.className)) {
    remainder.dataset.wordContinuation = '';
  }
  return remainder;
}

function splitTable(table: HTMLTableElement, fits: () => boolean) {
  // Row spans cross row boundaries; keep such tables intact instead of
  // guessing which cells belong on a continuation page.
  if (Array.from(table.rows).some((row) => Array.from(row.cells).some((cell) => cell.rowSpan > 1)))
    return null;
  const remainder = withoutId(table.cloneNode(true) as HTMLTableElement);
  for (const row of Array.from(remainder.rows)) row.remove();
  remainder.querySelector('caption')?.replaceChildren();
  while (table.rows.length > 1 && !fits()) {
    const row = table.rows[table.rows.length - 1];
    const group = row.parentElement!;
    const groupIndex = Array.from(table.children).indexOf(group);
    const destination = remainder.children[groupIndex] || remainder;
    destination.prepend(row);
  }
  if (fits() && remainder.rows.length) return remainder;
  for (const row of Array.from(remainder.rows)) {
    const group = row.parentElement!;
    const groupIndex = Array.from(remainder.children).indexOf(group);
    (table.children[groupIndex] || table).append(row);
  }
  return null;
}

/** Add automatic preview pages; docx-preview only handles saved/manual breaks. */
export async function paginateWord(doc: Document, isActive: () => boolean) {
  const win = doc.defaultView;
  if (!win) return;
  let measuredBlocks = 0;
  const originals = Array.from(doc.querySelectorAll<HTMLElement>('section.docx'));
  for (const original of originals) {
    if (!isActive()) return;
    const pageHeight = parseFloat(win.getComputedStyle(original).minHeight);
    if (!Number.isFinite(pageHeight) || pageHeight < 100) continue;
    const articles = Array.from(original.children).filter(
      // Adopted nodes keep the renderer's realm; iframe instanceof checks fail.
      (child): child is HTMLElement => child.tagName === 'ARTICLE',
    );
    // Complex column layouts stay intact; automatic vertical pagination must
    // not reorder their reading order or silently lose content.
    if (articles.some((article) => Number(win.getComputedStyle(article).columnCount) > 1)) continue;
    const header = original.querySelector(':scope > header');
    const footer = original.querySelector(':scope > footer');
    const notes = Array.from(original.children).filter(
      (child) => !articles.includes(child as HTMLElement) && child !== header && child !== footer,
    );
    let current!: HTMLElement;
    let article!: HTMLElement;
    let lastPage = original;
    const newPage = (template: HTMLElement) => {
      current = withoutId(original.cloneNode(false) as HTMLElement);
      current.style.minHeight = `${pageHeight}px`;
      if (header) current.append(header.cloneNode(true));
      article = withoutId(template.cloneNode(false) as HTMLElement);
      current.append(article);
      if (footer) current.append(footer.cloneNode(true));
      lastPage.after(current);
      lastPage = current;
    };
    const fits = () => current!.getBoundingClientRect().height <= pageHeight + 1;
    for (const sourceArticle of articles) {
      if (!current) newPage(sourceArticle);
      else {
        article = withoutId(sourceArticle.cloneNode(false) as HTMLElement);
        current.insertBefore(article, current.querySelector(':scope > footer'));
      }
      const blocks = Array.from(sourceArticle.childNodes);
      for (const block of blocks) {
        let pending: Node | null = block;
        while (pending) {
          // Yield between batches, including continuations of a single long
          // paragraph. Closing or switching documents cancels the remaining work.
          if (++measuredBlocks % 24 === 0) {
            await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
            if (!isActive()) return;
          }
          article!.append(pending);
          if (fits() || pending.nodeType !== Node.ELEMENT_NODE) break;
          const element = pending as HTMLElement;
          const wholePage =
            article!.childNodes.length === 1 && current!.querySelectorAll('article').length === 1;
          // Avoid splitting headings and short paragraphs unnecessarily. An
          // oversized paragraph/table is split once it reaches an empty page.
          if (!wholePage) {
            element.remove();
            newPage(sourceArticle);
            continue;
          }
          const remainder =
            element.tagName === 'P'
              ? splitParagraph(element, fits)
              : element.tagName === 'TABLE'
                ? splitTable(element as HTMLTableElement, fits)
                : null;
          if (!remainder) break; // Keep oversized objects visible in full.
          newPage(sourceArticle);
          pending = remainder;
        }
      }
    }
    if (!current) continue;
    for (const note of notes)
      current!.insertBefore(note, current!.querySelector(':scope > footer'));
    original.remove();
  }
}
