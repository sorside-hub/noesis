# Noesis — Phase 1: UI/UX Foundation

A personal intellectual workspace and reflective note system combining long-form editorial essays with atomic micro-captures ("relics"), featuring a warm editorial aesthetic, Tiptap rich text editing, and complete responsive navigation.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> The architectural and aesthetic decisions below were confirmed in Phase 1 clarification and form the foundation for Phase 1 UI/UX:

- **Confirmed Aesthetic**: Warm editorial parchment canvas (`#FBF9F5` light, `#1C1917` dark) with warm sepia ink, limestone structural borders, and terracotta curatorial accents (`#9A3412` / `#C2410C`).
- **Confirmed Desktop Layout**: Flexible 3-column architecture consisting of a collapsible Navigation Sidebar (left), a structured Notes & Relics Stream with search and filters (middle), and a wide distraction-free Reading & Editor Pane (right).
- **Confirmed Content Model**: Hybrid workspace seamlessly supporting both long-form structured notes/notebooks (as seen in Folio) and atomic micro-captures/relics (as seen in Numen) with contextual categories (`Object`, `Memory`, `Quote`, `Lesson`).
- **Theme Architecture**: Centralized CSS custom properties with comprehensive Light, Dark, and System modes configured via Tailwind v4 `@custom-variant dark`.

---

### 1. Overview & Core Concept

- **What It Does**: Noesis is a personal intellectual sanctuary for writing, synthesis, and reflection. It bridges deep long-form editorial composition with spontaneous micro-capturing, allowing writers and researchers to record ideas, organize thoughts into notebooks and projects, and discover serendipitous connections across their personal knowledge graph.
- **Target Audience / Persona**: Writers, thinkers, researchers, and creators seeking a calm, typography-first digital atelier devoid of SaaS dashboard clutter or algorithmic distractions.
- **Key Value**: A unified, responsive, beautifully typeset reading and writing environment where every thought—from a fleeting quote to a multi-chapter essay—has its natural place.

---

### 2. User Experience & Visual Design

#### A. Aesthetic Identity & Color Tokens
Following the visual references from the Folio and Numen artifacts, the design system utilizes semantic CSS variables:

- **Canvas & Surfaces**:
  - Light Theme: Warm parchment base (`#FAF7F2`), subtle elevated cards (`#FFFFFF` with warm undertone), limestone borders (`#E8E3DA`).
  - Dark Theme: Deep antique charcoal base (`#181615`), elevated panels (`#221F1E`), delicate border hairpins (`#332E2C`).
- **Typography & Ink**:
  - Headings: High-contrast editorial serif (`Fraunces` / `Playfair Display`) for poetic titles, note headers, and brand identity.
  - Body & Workspace: Clean, humanistic sans-serif (`Plus Jakarta Sans`) for effortless legibility across dense notes and toolbars.
  - Metadata & Telemetry: Subtle tabular numerals and tracked small-caps for timestamps, word counts, and tags without static pill boxes.
- **Curatorial Accents**:
  - Terracotta / Clay (`#9A3412` / `#C2410C`) for active filters, note indicators, and floating capture quill.
  - Muted Amber & Ochre (`#B45309`) for saved highlights and star indicators.

#### B. Spatial Hierarchy & Responsiveness
- **Desktop (1440px baseline)**:
  - **Left Rail (Sidebar - 240px)**: Brand title ("Noesis"), primary views (`Home`, `Capture`, `Library`, `Editor`, `Discover`, `Projects`, `Settings`), Notebook lists, theme switch. Collapsible to 64px icon rail.
  - **Middle Column (Stream / List - 340px)**: Search bar, view mode switch (List vs. Cards), active notebook/tag filters, scrollable list of notes/relics with title, excerpt, date, and category.
  - **Right Column (Workspace / Editor - Flex-1)**: Breadcrumbs, action toolbar, note title, Tiptap rich-text canvas with floating formatting bubble menu and fixed minimal toolbar, word/character counter.
- **Tablet (768px – 1024px)**:
  - 2-column mode with collapsible sidebar drawer and toggle between Notes list and Editor canvas.
- **Mobile (< 768px)**:
  - Bottom navigation bar (Home, Capture, Library, Projects, Settings).
  - Single-column view with touch-friendly filter bars.
  - Full-screen distraction-free Note Editor with mobile bottom formatting bar.
  - Floating Capture Quill button with smooth modal reveal.

#### C. All 7 Core Pages

1. **Home / Overview**: Curated intellectual dashboard featuring "Thought of the Day" prompt, recent writing sessions, quick capture streak, pinned notebooks, and latest relics.
2. **Capture**: Fast capture studio for atomic thoughts, quotes, fleeting ideas, and memories. Supports tag categorization (`Object`, `Memory`, `Quote`, `Lesson`, `Idea`) and instant list/card grid switching.
3. **Knowledge Library**: Comprehensive repository of all notes, reading digests, essays, and archives with multi-criteria filtering (Notebooks, Tags, Favorites, Date modified) and search.
4. **Note Editor**: Dedicated Tiptap rich-text workspace with Title editing, Heading 1–3, Bold/Italic/Underline, Blockquotes, Bullet/Numbered lists, Links, Image embedding simulation, word & character counts, and distraction-free mode.
5. **Discover**: Serendipity and connection engine presenting resurfaced notes from the past ("On this day"), topic clusters, conceptual cross-links, and reflective prompt cards.
6. **Projects**: Multi-stage writing projects (Essays, Manuscripts, Research syntheses) with progress tracking, milestone checklists, and associated linked notes.
7. **Settings**: Theme selection (Light, Dark, System), typography scale adjustment, editor layout toggles, auto-save simulation preferences, and clean data export/reset controls.

---

### 3. Key Product Decisions & Trade-Offs

- **Tiptap Integration via StarterKit & Custom Extensions**:
  - *Chosen Approach*: Official `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-link`, and `@tiptap/extension-underline`.
  - *Why*: Provides headless, styling-agnostic prose editing with full Tailwind typography integration, customizable floating bubble menus, and zero boilerplate bugs.
- **Local Reactive Mock Store**:
  - *Chosen Approach*: A comprehensive, strongly typed React Context/hook state store (`useNoesisStore`) initialized with realistic editorial notes and relics, persisted to `localStorage` for stateful interactions during the session without backend dependencies.
  - *Why*: Conforms strictly to Phase 1 restrictions (no database, no backend, no authentication) while delivering full, authentic frontend interactivity (creating notes, tagging, editing, switching views, toggling favorites).
- **Anti-AI Slop & Zero-Pill Visual Discipline**:
  - *Chosen Approach*: Unboxed metadata with typographic separators (`·`), delicate 1px borders, generous editorial spacing, and avoidance of generic purple gradients or decorative status dots.

---

### 4. Technical Architecture & System Layout

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Noesis Application Root                         │
│    (ThemeProvider: Light / Dark / System + NoesisDataProvider)         │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌─────────────────────────┐                            ┌────────────────────────┐
│   Desktop View Layout   │                            │   Mobile View Layout   │
│ ┌─────────────────────┐ │                            │ ┌────────────────────┐ │
│ │ 1. Sidebar Nav      │ │                            │ │ Top Bar & Bread-   │ │
│ │  - Brand & Links    │ │                            │ │ crumb Navigation   │ │
│ │  - Notebooks & Tags │ │                            │ ├────────────────────┤ │
│ │  - Theme Switcher   │ │                            │ │ Active View        │ │
│ ├─────────────────────┤ │                            │ │  - Home / Stream   │ │
│ │ 2. Stream Column    │ │                            │ │  - Full Editor     │ │
│ │  - Search & Filters │ │                            │ │  - Quick Capture   │ │
│ │  - Notes / Relics   │ │                            │ ├────────────────────┤ │
│ ├─────────────────────┤ │                            │ │ Floating Quill     │ │
│ │ 3. Editor Workspace │ │                            │ ├────────────────────┤ │
│ │  - Tiptap Toolbar   │ │                            │ │ Bottom Nav Rail    │ │
│ │  - Prose Canvas     │ │                            │ └────────────────────┘ │
│ │  - Metadata Footer  │ │                            │                        │
│ └─────────────────────┘ │                            └────────────────────────┘
└─────────────────────────┘
```

#### State & Data Entities
- **Note**: `id`, `title`, `content` (HTML/JSON), `notebookId`, `tags`, `favorite`, `archived`, `createdAt`, `updatedAt`, `readingTime`.
- **Relic (Quick Capture)**: `id`, `type` (`'object' | 'memory' | 'quote' | 'lesson' | 'idea'`), `title`, `body`, `tags`, `date`.
- **Project**: `id`, `title`, `description`, `status` (`'in_progress' | 'drafting' | 'completed'`), `progress`, `noteIds`, `targetWordCount`.
- **Theme**: `'light' | 'dark' | 'system'`.

---

### 5. Implementation Sequence (Post-Approval)

1. **Dependencies**: Batch-install `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-link`, `@tiptap/extension-underline`.
2. **Design Tokens & Fonts**: Configure Google Fonts (`Fraunces` & `Plus Jakarta Sans`) in `index.html`, set up `@custom-variant dark` and editorial CSS custom properties in `src/index.css`.
3. **Core State & Mock Data**: Create `src/types/index.ts` and `src/context/NoesisContext.tsx` with rich sample notes on philosophy, design, minimalism, reading notes, and relics.
4. **Reusable UI Components**: Buttons, Search inputs, Filter chips, Dropdowns, Card views, Modal dialogs, and Tooltips.
5. **Tiptap Rich Text Editor**: Compose `TiptapEditor.tsx` with title field, floating bubble menu, desktop/mobile formatting toolbars, and character/word statistics.
6. **Navigation & Shell**: Build responsive desktop 3-column layout, tablet drawer, and mobile bottom navigation with quick capture floating button.
7. **Pages**: Implement Home, Capture, Knowledge Library, Note Editor, Discover, Projects, and Settings.
8. **Verification & Linting**: Run `compile_applet` and `lint_applet` to ensure error-free compilation and fluid interactions.
