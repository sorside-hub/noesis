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
 * Sanitizes parsed HTML, removes empty spacer paragraphs/divs, and clamps headings to editor limits.
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

  // 5. Remove empty spacer <p> / <div> nodes (since CSS .tiptap already provides paragraph spacing)
  body.querySelectorAll('p, div').forEach((block) => {
    if (block.querySelector('img, figure, hr, pre, ul, ol, blockquote, table')) return;
    const text = (block.textContent || '').replace(/\u00a0/g, '').trim();
    if (text.length === 0) {
      block.remove();
    }
  });

  return body.innerHTML;
};

/**
 * Converts Markdown or plain text into clean HTML compatible with Tiptap.
 * Single-line inline snippets stay inline (no <p> wrapper) so mid-sentence pastes stay smooth.
 */
export const markdownOrPlainToCleanHtml = (
  rawText: string,
  options?: { minHeadingLevel?: number; maxHeadingLevel?: number }
): string => {
  const normalized = normalizePlainLineBreaks(rawText);
  if (!normalized) return '';

  const isSingleLineInline =
    !normalized.includes('\n') && !SINGLE_LINE_BLOCK_REGEX.test(normalized);

  const rendered = isSingleLineInline
    ? markdownParser.parseInline(normalized, { async: false })
    : markdownParser.parse(normalized, { async: false });

  return sanitizeAndNormalizeHtml(rendered, {
    minHeadingLevel: options?.minHeadingLevel,
    maxHeadingLevel: options?.maxHeadingLevel,
    skipIfProseMirror: false,
  });
};

// =========================================================================
// CLEAN PLAIN-TEXT CLIPBOARD SERIALIZER (Opsi B: Rapi, bebas double newline)
// =========================================================================

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
    return serializeFragmentBlocks(node.content);
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
  const blocks: string[] = [];

  fragment.forEach((child) => {
    if (child.isText) {
      const txt = child.text || '';
      if (txt) blocks.push(txt);
      return;
    }
    const serialized = serializeBlockNode(child, 0);
    if (serialized.trim().length > 0) {
      blocks.push(serialized);
    }
  });

  return blocks.join('\n\n');
};

/**
 * Serializes a copied ProseMirror Slice into clean plain text:
 * - Blocks (paragraphs, headings, lists, blockquotes) separated by a single blank line (\n\n).
 * - Empty <p></p> nodes ignored so double blank lines never happen.
 * - Bullet/numbered list items separated by a single newline (\n) with '- ' or '1. '.
 */
export const serializeSliceToCleanPlainText = (slice: Slice): string => {
  return serializeFragmentBlocks(slice.content);
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
