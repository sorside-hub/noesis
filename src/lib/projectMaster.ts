import { Project, ProjectSection, Milestone } from '../types';
import { cleanTextForEmbedding } from './cloudflareEmbedding';

export const countWordsFromContent = (rawHtmlOrText: string): number => {
  const cleaned = cleanTextForEmbedding(rawHtmlOrText || '').trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
};

export const getSortedProjectSections = (project: Project): ProjectSection[] => {
  const list = Array.isArray(project.sections) ? [...project.sections] : [];
  return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
};

export const countProjectTotalWords = (project: Project): number => {
  const sections = getSortedProjectSections(project);
  return sections.reduce((sum, sec) => sum + countWordsFromContent(sec.content), 0);
};

export const sectionHasWrittenContent = (section: ProjectSection): boolean => {
  return cleanTextForEmbedding(section.content || '').trim().length > 0;
};

export const projectHasWrittenContent = (project: Project): boolean => {
  const sections = getSortedProjectSections(project);
  return sections.some((s) => sectionHasWrittenContent(s));
};

export const computeProjectProgress = (
  sections: ProjectSection[] = [],
  milestones: Milestone[] = []
): number => {
  if (sections.length > 0) {
    const doneCount = sections.filter((s) => s.status === 'done').length;
    return Math.round((doneCount / sections.length) * 100);
  }
  if (milestones.length > 0) {
    const completedCount = milestones.filter((m) => m.completed).length;
    return Math.round((completedCount / milestones.length) * 100);
  }
  return 0;
};

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const compileProjectMasterHtml = (project: Project): string => {
  const sections = getSortedProjectSections(project);
  const parts: string[] = [];

  if (project.description?.trim()) {
    parts.push(`<p><em>${escapeHtml(project.description.trim())}</em></p>`);
  }

  for (const sec of sections) {
    parts.push(`<h2>${escapeHtml(sec.title || 'Bagian Tanpa Judul')}</h2>`);
    const cleaned = (sec.content || '').trim();
    if (cleaned && cleanTextForEmbedding(cleaned).trim().length > 0) {
      parts.push(cleaned);
    } else {
      parts.push('<p><em>(Bagian ini belum diisi)</em></p>');
    }
  }

  return parts.join('\n');
};

const serializeNodeToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const childrenText = () =>
    Array.from(el.childNodes)
      .map(serializeNodeToMarkdown)
      .join('');

  switch (tag) {
    case 'br':
      return '\n';
    case 'strong':
    case 'b': {
      const inner = childrenText().trim();
      return inner ? `**${inner}**` : '';
    }
    case 'em':
    case 'i': {
      const inner = childrenText().trim();
      return inner ? `*${inner}*` : '';
    }
    case 'u':
      return childrenText();
    case 'code': {
      const parentTag = el.parentElement?.tagName.toLowerCase();
      if (parentTag === 'pre') return childrenText();
      return `\`${childrenText()}\``;
    }
    case 'pre': {
      const code = el.textContent || '';
      return `\n\`\`\`\n${code.trimEnd()}\n\`\`\`\n\n`;
    }
    case 'a': {
      const href = el.getAttribute('href') || '';
      const text = childrenText().trim();
      return href ? `[${text || href}](${href})` : text;
    }
    case 'h1': {
      const t = childrenText().trim();
      return t ? `# ${t}\n\n` : '';
    }
    case 'h2': {
      const t = childrenText().trim();
      return t ? `## ${t}\n\n` : '';
    }
    case 'h3': {
      const t = childrenText().trim();
      return t ? `### ${t}\n\n` : '';
    }
    case 'blockquote': {
      const inner = childrenText().trim();
      if (!inner) return '';
      const quoted = inner
        .split('\n')
        .map((line) => (line.trim() ? `> ${line}` : '>'))
        .join('\n');
      return `${quoted}\n\n`;
    }
    case 'ul': {
      const items = Array.from(el.children)
        .filter((c) => c.tagName.toLowerCase() === 'li')
        .map((li) => `- ${serializeNodeToMarkdown(li).replace(/\n+/g, ' ').trim()}`)
        .filter((line) => line !== '-');
      return items.length ? `${items.join('\n')}\n\n` : '';
    }
    case 'ol': {
      const items = Array.from(el.children)
        .filter((c) => c.tagName.toLowerCase() === 'li')
        .map((li, i) => `${i + 1}. ${serializeNodeToMarkdown(li).replace(/\n+/g, ' ').trim()}`)
        .filter((line) => !/^\d+\.\s*$/.test(line));
      return items.length ? `${items.join('\n')}\n\n` : '';
    }
    case 'li':
      return childrenText().trim();
    case 'hr':
      return '---\n\n';
    case 'p': {
      const inner = childrenText().trim();
      return inner ? `${inner}\n\n` : '';
    }
    default:
      return childrenText();
  }
};

export const htmlToCleanMarkdown = (html: string): string => {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') {
    return cleanTextForEmbedding(html);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const raw = Array.from(doc.body.childNodes)
    .map(serializeNodeToMarkdown)
    .join('');
  return raw.replace(/\n{3,}/g, '\n\n').trim();
};

export const compileProjectMasterMarkdown = (project: Project): string => {
  const sections = getSortedProjectSections(project);
  const blocks: string[] = [];

  blocks.push(`# ${project.title || 'Project Tanpa Judul'}`);
  if (project.description?.trim()) {
    blocks.push(`*${project.description.trim()}*`);
  }

  for (const sec of sections) {
    blocks.push(`## ${sec.title || 'Bagian Tanpa Judul'}`);
    const mdBody = htmlToCleanMarkdown(sec.content || '');
    if (mdBody) {
      blocks.push(mdBody);
    }
  }

  return blocks.join('\n\n').trim();
};

export const compileProjectMasterPlainText = (project: Project): string => {
  const sections = getSortedProjectSections(project);
  const blocks: string[] = [];

  blocks.push(project.title || 'Project Tanpa Judul');
  if (project.description?.trim()) {
    blocks.push(project.description.trim());
  }

  for (const sec of sections) {
    blocks.push(sec.title || 'Bagian Tanpa Judul');
    const md = htmlToCleanMarkdown(sec.content || '')
      .replace(/^#{1,3}\s+/gm, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
    if (md) {
      blocks.push(md);
    }
  }

  return blocks.join('\n\n').trim();
};
