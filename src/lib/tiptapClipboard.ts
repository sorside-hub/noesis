import { Marked } from 'marked';
import type { Fragment as ProseMirrorFragment, Node as ProseMirrorNode, Slice } from '@tiptap/pm/model';
import type { EditorProps, EditorView } from '@tiptap/pm/view';

const markdownParser = new Marked({
  gfm: true,
  breaks: true,
  async: false,
});

const SEMANTIC_HTML_SELECTOR =
  'h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, pre, code, a[href], strong, em, i, u, s, del, table, figure, img';

const MARKDOWN_SYNTAX_REGEX =
  /(^|\n)\s{0,3}(#{1,6}\s+\S|[-*+]\s+\S|\d+\.\s+\S|>\s+\S|```|~~~|([-*_])(\s*\3){2,}\s*$)|(\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\((https?:\/\/|\/|#)[^)\s]+\))/;

const SINGLE_LINE_BLOCK_REGEX =
  /^\s{0,3}(#{1,6}\s+\S|[-*+]\s+\S|\d+\.\s+\S|>\s+\S|```|~~~|([-*_])(\s*\2){2,}\s*$)/;

const BLOCKED_TAGS_SELECTOR = 'script, style, iframe, object, embed, form, input, textarea, select, button';

/**
 * Normalizes line endings and collapses 2+ consecutive blank lines down to 1 blank line (\n\n)
 * so pasted text never spawns stacked empty paragraphs.
 */
const normalizePlainLineBreaks = (raw: string): string => {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n')
    .trim();
};

/**
 * Checks whether clipboard text/html genuinely carries rich formatting semantics
 * vs merely being a plain-text/code wrapper (e.g. VS Code, <pre>, Google Docs normal wrapper, Notion/Obsidian raw text).
 */
const hasRichSemanticHtml = (html: string, plainText: string): boolean => {
  if (!html || !html.trim()) return false;
  if (html.includes('data-pm-slice')) return true;

  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return /<(h[1-6]|ul|ol|li|blockquote|strong|em|a\s+href)/i.test(html);
  }

  const doc = new window.DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;
  if (!body) return false;

  // If clipboard plainText clearly contains raw Markdown syntax and HTML has no real structural blocks,
  // prefer Markdown parsing (handles copying Markdown from <textarea>, VS Code, code blocks, etc.).
  const hasStructuralHtml = Boolean(
    body.querySelector('h1, h2, h3, h4, h5, h6, ul, ol, li, blockquote, table, figure, img')
  );
  if (!hasStructuralHtml && MARKDOWN_SYNTAX_REGEX.test(plainText)) {
    return false;
  }

  if (body.querySelector(SEMANTIC_HTML_SELECTOR)) {
    return true;
  }

  // Google Docs wraps everything in <b style="font-weight: normal" id="docs-internal-guid-...">
  const boldTags = Array.from(body.querySelectorAll('b'));
  for (const b of boldTags) {
    const fw = (b.style?.fontWeight || '').toLowerCase().trim();
    const isDocsWrapper = b.id?.startsWith('docs-internal-guid-') || fw === 'normal' || fw === '400';
    if (!isDocsWrapper) return true;
  }

  // Spans with inline bold / italic / underline styling (e.g. Google Docs / Word)
  const styledSpans = Array.from(body.querySelectorAll('span[style]'));
  for (const span of styledSpans) {
    const fw = (span.getAttribute('style') || '').toLowerCase();
    if (
      /font-weight\s*:\s*(bold|bolder|[6-9]00)/.test(fw) ||
      /font-style\s*:\s*italic/.test(fw) ||
      /text-decoration[^;]*underline/.test(fw)
    ) {
      return true;
    }
  }

  // Simple <p> wrappers without Markdown syntax (e.g. plain paragraphs copied from a webpage)
  if (body.querySelector('p')) {
    return true;
  }

  return false;
};

/**
 * Sanitizes parsed HTML, preserves intentional empty paragraph spacers (<p><br></p>) for Enter 2x,
 * collapses redundant empty spacers, and clamps headings to editor limits.
 */
export const sanitizeAndNormalizeHtml = (
  rawHtml: string,
  options?: { minHeadingLevel?: number; maxHeadingLevel?: number; skipIfProseMirror?: boolean }
): string => {
  const minH = options?.minHeadingLevel ?? 1;
  const maxH = options?.maxHeadingLevel ?? 3;

  if (!rawHtml) return '';
  if (options?.skipIfProseMirror && rawHtml.includes('data-pm-slice')) {
    return rawHtml;
  }
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return rawHtml;
  }

  const doc = new window.DOMParser().parseFromString(rawHtml, 'text/html');
  const body = doc.body;
  if (!body) return rawHtml;

  // 1. Strip dangerous elements
  body.querySelectorAll(BLOCKED_TAGS_SELECTOR).forEach((el) => el.remove());

  // 2. Unwrap Google Docs normal-weight <b> wrappers
  body.querySelectorAll('b').forEach((b) => {
    const fw = (b.style?.fontWeight || '').toLowerCase().trim();
    if (b.id?.startsWith('docs-internal-guid-') || fw === 'normal' || fw === '400') {
      b.replaceWith(...Array.from(b.childNodes));
    }
  });

  // 3. Sanitize attributes (strip on* handlers and unsafe javascript: links)
  body.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
      } else if (name === 'href' || name === 'src') {
        const val = attr.value.trim().toLowerCase();
        if (val.startsWith('javascript:') || val.startsWith('vbscript:')) {
          el.removeAttribute(attr.name);
        }
      }
    }
  });

  // 4. Clamp heading tags to supported levels (e.g. h4..h6 -> h3, or h1 -> h2 if minHeadingLevel = 2)
  body.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    const clamped = Math.min(maxH, Math.max(minH, level));
    if (clamped !== level) {
      const replacement = doc.createElement(`h${clamped}`);
      replacement.innerHTML = heading.innerHTML;
      heading.replaceWith(replacement);
    }
  });

  // 5. Normalize empty spacer <p> / <div> blocks:
  // - Preserve intentional blank line spacers (<p><br></p>) for Enter 2x behavior.
  // - Collapse multiple consecutive empty blocks down to at most 1 empty spacer.
  // - Strip leading and trailing empty blocks, and empty blocks immediately adjacent to headings.
  const childBlocks = Array.from(body.children);
  let lastWasEmptyParagraph = false;

  for (let i = 0; i < childBlocks.length; i++) {
    const el = childBlocks[i];
    const tag = el.tagName.toLowerCase();

    // If it's a div, convert to p if it acts as a paragraph block
    let targetEl = el;
    if (
      tag === 'div' &&
      !el.querySelector('h1, h2, h3, h4, h5, h6, ul, ol, blockquote, pre, table, img, figure')
    ) {
      const p = doc.createElement('p');
      p.innerHTML = el.innerHTML;
      el.replaceWith(p);
      targetEl = p;
    }

    const currentTag = targetEl.tagName.toLowerCase();
    if (currentTag === 'p') {
      if (targetEl.querySelector('img, figure, hr, pre, ul, ol, blockquote, table')) {
        lastWasEmptyParagraph = false;
        continue;
      }
      const text = (targetEl.textContent || '').replace(/\u00a0/g, '').trim();
      const isEmpty = text.length === 0;

      if (isEmpty) {
        const prevSibling = targetEl.previousElementSibling;
        const nextSibling = targetEl.nextElementSibling;
        const prevIsHeading = Boolean(prevSibling && /^h[1-6]$/i.test(prevSibling.tagName));
        const nextIsHeading = Boolean(nextSibling && /^h[1-6]$/i.test(nextSibling.tagName));

        if (!prevSibling || !nextSibling || prevIsHeading || nextIsHeading || lastWasEmptyParagraph) {
          targetEl.remove();
        } else {
          targetEl.innerHTML = '<br>';
          lastWasEmptyParagraph = true;
        }
      } else {
        lastWasEmptyParagraph = false;
      }
    } else {
      lastWasEmptyParagraph = false;
    }
  }

  return body.innerHTML;
};

/**
 * Converts Markdown or plain text into clean HTML compatible with Tiptap.
 * - Single newline in plain text produces tight paragraphs (<p>line1</p><p>line2</p>).
 * - Double newline in plain text produces an intentional empty spacer (<p>line1</p><p><br></p><p>line2</p>).
 * - Single-line inline snippets stay inline (no <p> wrapper) so mid-sentence pastes stay smooth.
 */
export const markdownOrPlainToCleanHtml = (
  rawText: string,
  options?: { minHeadingLevel?: number; maxHeadingLevel?: number }
): string => {
  const normalized = normalizePlainLineBreaks(rawText);
  if (!normalized) return '';

  const isSingleLineInline =
    !normalized.includes('\n') && !SINGLE_LINE_BLOCK_REGEX.test(normalized);

  if (isSingleLineInline) {
    return markdownParser.parseInline(normalized, { async: false });
  }

  // Pure plain text (e.g. copied from WhatsApp, Telegram, or Notepad without Markdown syntax)
  if (!MARKDOWN_SYNTAX_REGEX.test(normalized)) {
    const lines = normalized.split('\n');
    const htmlBlocks: string[] = [];
    let lastWasBlank = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        if (!lastWasBlank && htmlBlocks.length > 0) {
          htmlBlocks.push('<p><br></p>');
          lastWasBlank = true;
        }
      } else {
        htmlBlocks.push(`<p>${escapeHtmlText(line)}</p>`);
        lastWasBlank = false;
      }
    }

    while (htmlBlocks.length > 0 && htmlBlocks[htmlBlocks.length - 1] === '<p><br></p>') {
      htmlBlocks.pop();
    }

    return htmlBlocks.join('');
  }

  // Markdown syntax detected: parse with Marked
  let rendered = markdownParser.parse(normalized, { async: false });
  // In Markdown, two consecutive <p> tags represent two paragraphs separated by \n\n.
  // Insert intentional blank line spacer <p><br></p> between them so they render with the blank line gap:
  rendered = rendered.replace(/<\/p>\s*<p>/g, '</p><p><br></p><p>');

  return sanitizeAndNormalizeHtml(rendered, {
    minHeadingLevel: options?.minHeadingLevel,
    maxHeadingLevel: options?.maxHeadingLevel,
    skipIfProseMirror: false,
  });
};

// =========================================================================
// CLEAN PLAIN-TEXT CLIPBOARD SERIALIZER
// =========================================================================

interface SerializedBlock {
  type: string;
  text: string;
}

const isMajorBlock = (type: string): boolean => {
  return (
    type === 'heading' ||
    type === 'bulletList' ||
    type === 'orderedList' ||
    type === 'blockquote' ||
    type === 'codeBlock' ||
    type === 'horizontalRule'
  );
};

const serializeInlineChildren = (node: ProseMirrorNode): string => {
  let out = '';
  node.forEach((child) => {
    if (child.isText) {
      out += child.text || '';
    } else if (child.type.name === 'hardBreak') {
      out += '\n';
    } else if (child.isLeaf) {
      out += child.textContent || '';
    } else {
      out += serializeInlineChildren(child);
    }
  });
  return out;
};

const serializeListItem = (
  itemNode: ProseMirrorNode,
  prefix: string,
  depth: number
): string => {
  const indent = '  '.repeat(depth);
  const lines: string[] = [];
  let isFirstParagraph = true;

  itemNode.forEach((child) => {
    const typeName = child.type.name;
    if (typeName === 'bulletList' || typeName === 'orderedList') {
      const nested = serializeList(child, depth + 1);
      if (nested) lines.push(nested);
    } else if (typeName === 'paragraph' || child.isTextblock) {
      const text = serializeInlineChildren(child).trimEnd();
      if (isFirstParagraph) {
        lines.push(`${indent}${prefix}${text}`);
        isFirstParagraph = false;
      } else if (text.length > 0) {
        lines.push(`${indent}  ${text}`);
      }
    } else {
      const fallback = serializeBlockNode(child, depth + 1);
      if (fallback) lines.push(fallback);
    }
  });

  if (isFirstParagraph) {
    lines.unshift(`${indent}${prefix}`.trimEnd());
  }

  return lines.join('\n');
};

const serializeList = (listNode: ProseMirrorNode, depth: number): string => {
  const isOrdered = listNode.type.name === 'orderedList';
  let index = typeof listNode.attrs?.order === 'number' ? listNode.attrs.order : 1;
  const itemLines: string[] = [];

  listNode.forEach((child) => {
    if (child.type.name === 'listItem') {
      const prefix = isOrdered ? `${index}. ` : '- ';
      itemLines.push(serializeListItem(child, prefix, depth));
      index += 1;
    } else {
      const fallback = serializeBlockNode(child, depth);
      if (fallback) itemLines.push(fallback);
    }
  });

  return itemLines.join('\n');
};

const serializeBlockNode = (node: ProseMirrorNode, listDepth = 0): string => {
  const typeName = node.type.name;

  if (typeName === 'paragraph' || typeName === 'heading') {
    return serializeInlineChildren(node).replace(/\s+$/g, '');
  }

  if (typeName === 'codeBlock') {
    return node.textContent;
  }

  if (typeName === 'bulletList' || typeName === 'orderedList') {
    return serializeList(node, listDepth);
  }

  if (typeName === 'blockquote') {
    const inner = serializeFragmentBlocks(node.content);
    if (!inner) return '';
    return inner
      .split('\n')
      .map((line) => (line.trim() ? `> ${line}` : '>'))
      .join('\n');
  }

  if (typeName === 'horizontalRule') {
    return '---';
  }

  if (node.isTextblock) {
    return serializeInlineChildren(node).trimEnd();
  }

  if (node.isText) {
    return node.text || '';
  }

  return serializeFragmentBlocks(node.content);
};

const serializeFragmentBlocks = (fragment: ProseMirrorFragment): string => {
  const rawBlocks: SerializedBlock[] = [];

  fragment.forEach((child) => {
    if (child.isText) {
      const txt = child.text || '';
      if (txt) rawBlocks.push({ type: 'text', text: txt });
      return;
    }
    const typeName = child.type.name;
    const serialized = serializeBlockNode(child, 0);
    rawBlocks.push({ type: typeName, text: serialized });
  });

  // Filter out leading/trailing empty paragraphs, empty paragraphs adjacent to major blocks,
  // and collapse consecutive empty paragraphs to at most 1
  const cleaned: SerializedBlock[] = [];
  for (let idx = 0; idx < rawBlocks.length; idx++) {
    const block = rawBlocks[idx];
    const isBlankParagraph =
      block.type === 'paragraph' && block.text.trim().length === 0;

    if (isBlankParagraph) {
      if (cleaned.length === 0) continue;
      const prev = cleaned[cleaned.length - 1];
      if (isMajorBlock(prev.type)) continue;
      const next = rawBlocks[idx + 1];
      if (next && isMajorBlock(next.type)) continue;
      if (prev.type === 'paragraph' && prev.text.trim().length === 0) continue;
    }

    cleaned.push(block);
  }

  // Remove trailing empty paragraphs
  while (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    if (last.type === 'paragraph' && last.text.trim().length === 0) {
      cleaned.pop();
    } else {
      break;
    }
  }

  if (cleaned.length === 0) return '';

  let out = '';
  for (let i = 0; i < cleaned.length; i++) {
    const curr = cleaned[i];
    if (i === 0) {
      out += curr.text;
      continue;
    }
    const prev = cleaned[i - 1];
    const prevIsMajor = isMajorBlock(prev.type);
    const currIsMajor = isMajorBlock(curr.type);

    if (prevIsMajor || currIsMajor) {
      out += '\n\n' + curr.text;
    } else {
      // Both are paragraphs / inline text: single newline preserves tight line spacing
      out += '\n' + curr.text;
    }
  }

  return out;
};

/**
 * Serializes a copied ProseMirror Slice into clean plain text:
 * - Enter 1x (<p>...</p><p>...</p>) serializes tightly with a single newline (\n).
 * - Enter 2x (empty spacer <p></p>) serializes with an intentional blank line (\n\n).
 * - Major blocks (headings, lists, blockquotes) separated by \n\n.
 */
export const serializeSliceToCleanPlainText = (slice: Slice): string => {
  return serializeFragmentBlocks(slice.content);
};

const escapeHtmlText = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Strips editor-specific classes/styles and dangerous nodes, while preserving
 * intentional blank line spacers (<p><br></p>) so copied HTML pastes cleanly
 * into Google Docs, Word, Notion, or Email without dark-mode or spacing artifacts.
 */
const buildCleanClipboardHtml = (title: string, bodyHtml: string): string => {
  const cleanTitle = title.trim();
  let cleanBodyHtml = '';

  if (bodyHtml && bodyHtml.trim()) {
    if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
      const doc = new window.DOMParser().parseFromString(bodyHtml, 'text/html');
      const body = doc.body;
      if (body) {
        body.querySelectorAll(BLOCKED_TAGS_SELECTOR).forEach((el) => el.remove());

        // Normalize empty spacer blocks (<p><br></p>) for Google Docs / Word compatibility
        const childBlocks = Array.from(body.children);
        let lastWasEmpty = false;

        for (const block of childBlocks) {
          const tag = block.tagName.toLowerCase();
          if (tag === 'p' || tag === 'div') {
            if (block.querySelector('img, figure, hr, pre, ul, ol, blockquote, table')) {
              lastWasEmpty = false;
              continue;
            }
            const text = (block.textContent || '').replace(/\u00a0/g, '').trim();
            if (text.length === 0) {
              const prev = block.previousElementSibling;
              const next = block.nextElementSibling;
              const prevIsH = Boolean(prev && /^h[1-6]$/i.test(prev.tagName));
              const nextIsH = Boolean(next && /^h[1-6]$/i.test(next.tagName));

              if (!prev || !next || prevIsH || nextIsH || lastWasEmpty) {
                block.remove();
              } else {
                block.innerHTML = '<br>';
                lastWasEmpty = true;
              }
            } else {
              lastWasEmpty = false;
            }
          } else {
            lastWasEmpty = false;
          }
        }

        // Strip Tailwind classes, inline styles, and event handlers
        body.querySelectorAll('*').forEach((el) => {
          for (const attr of Array.from(el.attributes)) {
            const name = attr.name.toLowerCase();
            if (name === 'class' || name === 'style' || name.startsWith('on')) {
              el.removeAttribute(attr.name);
            } else if (name === 'href' || name === 'src') {
              const val = attr.value.trim().toLowerCase();
              if (val.startsWith('javascript:') || val.startsWith('vbscript:')) {
                el.removeAttribute(attr.name);
              }
            }
          }
        });

        cleanBodyHtml = body.innerHTML.trim();
      }
    } else {
      cleanBodyHtml = bodyHtml.trim();
    }
  }

  const parts: string[] = [];
  if (cleanTitle) {
    parts.push(`<h1>${escapeHtmlText(cleanTitle)}</h1>`);
  }
  if (cleanBodyHtml) {
    parts.push(cleanBodyHtml);
  }
  return parts.join('\n');
};

/**
 * Fallback plain-text converter from HTML when a ProseMirror doc instance is unavailable.
 */
const htmlToFallbackPlainText = (rawHtml: string): string => {
  if (!rawHtml || !rawHtml.trim()) return '';
  if (typeof window === 'undefined' || typeof window.DOMParser === 'undefined') {
    return rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new window.DOMParser().parseFromString(rawHtml, 'text/html');
  const body = doc.body;
  if (!body) return '';

  const blocks: { tag: string; text: string }[] = [];
  Array.from(body.children).forEach((el) => {
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent || '').replace(/\u00a0/g, ' ').trim();
    blocks.push({ tag, text });
  });

  const cleaned: { tag: string; text: string }[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.tag === 'p' && b.text.length === 0) {
      if (cleaned.length === 0) continue;
      const prev = cleaned[cleaned.length - 1];
      if (/^h[1-6]$/i.test(prev.tag) || (prev.tag === 'p' && prev.text.length === 0)) continue;
      const next = blocks[i + 1];
      if (next && /^h[1-6]$/i.test(next.tag)) continue;
    }
    cleaned.push(b);
  }

  while (cleaned.length > 0 && cleaned[cleaned.length - 1].text.length === 0) {
    cleaned.pop();
  }

  let out = '';
  for (let i = 0; i < cleaned.length; i++) {
    const curr = cleaned[i];
    if (i === 0) {
      out += curr.text;
      continue;
    }
    const prev = cleaned[i - 1];
    const prevIsH = /^h[1-6]$/i.test(prev.tag);
    const currIsH = /^h[1-6]$/i.test(curr.tag);
    if (prevIsH || currIsH) {
      out += '\n\n' + curr.text;
    } else {
      out += '\n' + curr.text;
    }
  }

  return out.trim();
};

/**
 * Copies a formatted Note (Title + Body only) to the clipboard using dual-format
 * (text/plain + clean text/html) so pasting works cleanly in both plain-text apps
 * (WhatsApp, Telegram, Notepad) and rich-text apps (Google Docs, Word, Gmail, Notion).
 */
export const copyFormattedNoteToClipboard = async ({
  title,
  html,
  doc,
}: {
  title: string;
  html: string;
  doc?: ProseMirrorNode | null;
}): Promise<boolean> => {
  const cleanTitle = title.trim();
  const bodyPlain = doc
    ? serializeFragmentBlocks(doc.content).trim()
    : htmlToFallbackPlainText(html);

  const plainText = [cleanTitle, bodyPlain].filter(Boolean).join('\n\n');
  const cleanHtml = buildCleanClipboardHtml(cleanTitle, html);

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.write === 'function' &&
      typeof ClipboardItem !== 'undefined'
    ) {
      const itemData: Record<string, Blob> = {
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      };
      if (cleanHtml) {
        itemData['text/html'] = new Blob([cleanHtml], { type: 'text/html' });
      }
      await navigator.clipboard.write([new ClipboardItem(itemData)]);
      return true;
    }
  } catch {
    // Fall through to writeText / execCommand fallbacks
  }

  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(plainText);
      return true;
    }
  } catch {
    // Fall through to textarea execCommand fallback
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = plainText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      return ok;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  return false;
};

/**
 * Builds shared ProseMirror EditorProps for smart Markdown/plain-text paste,
 * clean HTML normalization, and clean plain-text copy serialization.
 */
export const createTiptapClipboardProps = (options?: {
  minHeadingLevel?: number;
  maxHeadingLevel?: number;
}): Pick<EditorProps, 'handlePaste' | 'transformPastedHTML' | 'clipboardTextSerializer'> => {
  let isSyntheticPaste = false;

  return {
    handlePaste: (view: EditorView, event: ClipboardEvent) => {
      if (isSyntheticPaste) return false;
      const clipboard = event.clipboardData;
      if (!clipboard) return false;

      // Let native/file handlers handle image/binary pastes if there is no text
      const plainText = clipboard.getData('text/plain') || '';
      const html = clipboard.getData('text/html') || '';

      if (!plainText.trim()) return false;
      if (html.includes('data-pm-slice')) return false;

      if (hasRichSemanticHtml(html, plainText)) {
        // Rich HTML will pass through transformPastedHTML automatically
        return false;
      }

      const parsedHtml = markdownOrPlainToCleanHtml(plainText, options);
      if (!parsedHtml) return false;

      event.preventDefault();
      isSyntheticPaste = true;
      try {
        return view.pasteHTML(parsedHtml);
      } finally {
        isSyntheticPaste = false;
      }
    },

    transformPastedHTML: (html: string) => {
      return sanitizeAndNormalizeHtml(html, {
        minHeadingLevel: options?.minHeadingLevel,
        maxHeadingLevel: options?.maxHeadingLevel,
        skipIfProseMirror: true,
      });
    },

    clipboardTextSerializer: (slice: Slice) => {
      return serializeSliceToCleanPlainText(slice);
    },
  };
};
