import { Note, Notebook, Relic, Fragment, Project } from '../types';

export const INITIAL_NOTEBOOKS: Notebook[] = [
  { id: 'personal', name: 'Personal Reflections', count: 8, description: 'Private journal entries and philosophical musings' },
  { id: 'work', name: 'Work & Ventures', count: 6, description: 'Strategic roadmaps, architecture, and design sprints' },
  { id: 'reading', name: 'Reading Notes', count: 7, description: 'Book distillations, Marginalia, and essay digests' },
  { id: 'ideas', name: 'App Ideas & Concepts', count: 5, description: 'Explorations, spatial interfaces, and thought experiments' },
  { id: 'philosophy', name: 'Stoicism & Mind', count: 4, description: 'Classical philosophy, ethical models, and epistemic inquiries' },
];

export const INITIAL_NOTES: Note[] = [
  {
    id: 'note-1',
    title: 'Thoughts on Minimalism',
    type: 'thought',
    notebookId: 'personal',
    tags: ['minimalism', 'clarity', 'philosophy'],
    source: 'Socrates & Seneca reflections',
    favorite: true,
    archived: false,
    relatedNoteIds: ['note-3', 'note-6'],
    createdAt: '2026-02-03T14:34:00Z',
    updatedAt: '2026-02-03T15:20:00Z',
    wordCount: 342,
    excerpt: 'The essence of minimalism isn’t about having less, but about making room for more of what matters. It’s a conscious choice...',
    content: `
      <p>The essence of minimalism isn't about having less, but about <strong>making room for more of what matters</strong>. It's a conscious choice to eliminate the unnecessary so that we can focus on what brings genuine value to our lives.</p>
      <h2>The Paradox of Choice</h2>
      <p>We live in an age of unprecedented abundance. Every day, we're faced with countless decisions—what to wear, what to eat, what to watch, what to buy. Each choice, no matter how small, depletes our mental energy.</p>
      <blockquote>The secret of happiness, you see, is not found in seeking more, but in developing the capacity to enjoy less. — Socrates</blockquote>
      <p>By intentionally limiting our options, we free up cognitive resources for the decisions that truly matter. This is why many successful thinkers wear the same outfit every day—not out of laziness, but out of wisdom.</p>
      <h2>Practical Steps</h2>
      <p>Starting a minimalist journey doesn't require dramatic changes. Small, consistent actions create durable momentum:</p>
      <ul>
        <li>Audit physical objects that have remained untouched for twelve months.</li>
        <li>Cultivate friction before new acquisitions: enforce a 72-hour contemplative pause.</li>
        <li>Protect quiet hours in the morning before digital noise encroaches.</li>
      </ul>
    `,
  },
  {
    id: 'note-2',
    title: 'Q1 Project Roadmap & Architectural Goals',
    type: 'idea',
    notebookId: 'work',
    tags: ['strategy', 'roadmap', 'engineering'],
    source: 'Internal Strategy Sprint 2026',
    favorite: false,
    archived: false,
    relatedNoteIds: ['note-5'],
    createdAt: '2026-02-02T09:15:00Z',
    updatedAt: '2026-02-02T11:45:00Z',
    wordCount: 280,
    excerpt: 'Key milestones for the quarter: Launch beta by February, complete user testing in March, and publish the core design specifications...',
    content: `
      <h2>Strategic Objectives</h2>
      <p>Deliver the first public revision of the Noesis editorial workspace with zero-compromise typography, fluid mobile responsiveness, and intuitive atomic capturing.</p>
      <h3>Milestones & Timeline</h3>
      <ul>
        <li><strong>Phase 1:</strong> UI/UX Foundation, semantic design tokens, and Tiptap integration.</li>
        <li><strong>Phase 2:</strong> Serendipity algorithms and knowledge graph topology.</li>
        <li><strong>Phase 3:</strong> Local-first encrypted sync protocols.</li>
      </ul>
      <p>Focus strictly on tactile quality and reading comfort over feature bloat.</p>
    `,
  },
  {
    id: 'note-3',
    title: 'Book: Atomic Habits by James Clear',
    type: 'reference',
    notebookId: 'reading',
    tags: ['habits', 'psychology', 'systems'],
    source: 'James Clear, Penguin Random House (2018)',
    favorite: true,
    archived: false,
    relatedNoteIds: ['note-1'],
    createdAt: '2026-01-31T18:00:00Z',
    updatedAt: '2026-01-31T19:30:00Z',
    wordCount: 410,
    excerpt: 'James Clear’s framework for building good habits: make it obvious, attractive, easy, and satisfying. You do not rise to the level of your goals...',
    content: `
      <h2>The 4 Laws of Behavior Change</h2>
      <p>Clear argues persuasively that systems invariably beat willpower. We do not rise to the level of our goals; <em>we fall to the level of our systems</em>.</p>
      <blockquote>Every action you take is a vote for the type of person you wish to become. No single instance will transform your beliefs, but as the votes build up, so does the evidence.</blockquote>
      <h3>Implementation Intentions</h3>
      <p>I will [BEHAVIOR] at [TIME] in [LOCATION]. By specifying the exact temporal and spatial context, ambiguity is dismantled.</p>
    `,
  },
  {
    id: 'note-4',
    title: 'App Ideas: Spatial Memory & Knowledge Canvases',
    type: 'idea',
    notebookId: 'ideas',
    tags: ['spatial-computing', 'ui-design', 'memory'],
    source: 'Method of Loci research & cognitive map studies',
    favorite: false,
    archived: false,
    relatedNoteIds: ['note-2'],
    createdAt: '2026-01-28T14:10:00Z',
    updatedAt: '2026-01-28T14:50:00Z',
    wordCount: 220,
    excerpt: 'A habit tracker and conceptual binder that uses spatial memory. Placing habits and relics in virtual rooms or memory palaces...',
    content: `
      <h2>Method of Loci in Modern Software</h2>
      <p>Human evolution honed spatial navigation for millennia, yet current software forces thoughts into vertical hierarchical lists. What if knowledge nodes had distinct spatial coordinates and weight?</p>
      <p>Exploration: Combine infinite 2D canvas navigation with strict editorial typography when inspecting individual nodes.</p>
    `,
  },
  {
    id: 'note-5',
    title: 'Meeting Notes: Design Review on Warm Editorial Themes',
    type: 'reference',
    notebookId: 'work',
    tags: ['design', 'typography', 'review'],
    source: 'Noesis Design Review Session #4',
    favorite: false,
    archived: false,
    relatedNoteIds: ['note-2'],
    createdAt: '2026-01-25T11:00:00Z',
    updatedAt: '2026-01-25T12:00:00Z',
    wordCount: 195,
    excerpt: 'Feedback on the new dashboard: simplify the navigation, increase contrast on secondary text, and adhere strictly to warm alabaster surfaces...',
    content: `
      <h2>Action Items & Design Consensus</h2>
      <ul>
        <li>Remove all static pill chips around dates and categories. Use subtle typography separators like middle dots.</li>
        <li>Adopt a 3-column desktop layout that preserves focus when writing long essays.</li>
        <li>Ensure dark mode uses warm charcoal rather than cold cyan-tinted pitch black.</li>
      </ul>
    `,
  },
  {
    id: 'note-6',
    title: 'Montaigne on Solitude and the Back-Shop of the Mind',
    type: 'thought',
    notebookId: 'philosophy',
    tags: ['montaigne', 'solitude', 'essays'],
    source: 'Michel de Montaigne, Essais (Book I, Ch. 39)',
    favorite: true,
    archived: false,
    relatedNoteIds: ['note-1'],
    createdAt: '2026-01-20T16:20:00Z',
    updatedAt: '2026-01-21T08:15:00Z',
    wordCount: 310,
    excerpt: 'We should have a back-shop all our own, entirely free, in which to establish our real freedom and our principal retreat and solitude...',
    content: `
      <p>Montaigne cautions against binding ourselves so tightly to society that we forget our independent sovereignty. In his famous tower library in Bordeaux, he engraved maxims upon the oak ceiling rafters.</p>
      <blockquote>We must reserve a back shop, all our own, entirely free, in which to establish our real liberty and our principal retreat and solitude.</blockquote>
      <p>True leisure is not indolence, but the untroubled enjoyment of one's own faculties.</p>
    `,
  },
];

export const INITIAL_FRAGMENTS: Fragment[] = [
  {
    id: 'fragment-1',
    type: 'thought',
    title: "Dad's old pocket watch...",
    content: 'Found this in the attic yesterday. It belonged to grandfather, then my father. The inscription reads "Time is the most valuable thing we can spend". It stopped working years ago but I asked mom if I can fit it up and keep it. It reminds me how fleeting life is and how precious each moment is.',
    tags: ['family', 'legacy', 'time'],
    date: '15/01/2026',
    source: 'Attic heirloom chest',
    starred: true,
  },
  {
    id: 'fragment-2',
    type: 'thought',
    title: 'First Snow of Winter',
    content: 'Woke up to the world transformed. Everything was still and quiet, like nature pressed reset. I stood at the kitchen window with my cup of coffee watching the specs of snow dance around streetlamp. There is something magic about the first snow. It feels like the air is full of wonder and new beginnings.',
    tags: ['seasons', 'nature', 'wonder'],
    date: '02/12/2025',
    starred: true,
  },
  {
    id: 'fragment-3',
    type: 'reference',
    title: 'Conversation at the Cafe',
    content: 'I was sketching in my usual corner at "The Daily Grind" when an elderly woman asked what I was drawing. We ended up talking for an hour about watercolor pigments, the changing city, and how art keeps the spirit young.',
    tags: ['connection', 'art', 'wisdom'],
    date: '14/11/2025',
    source: 'The Daily Grind cafe',
    starred: false,
  },
  {
    id: 'fragment-4',
    type: 'thought',
    title: 'The silent hum of accomplishment',
    content: 'After weeks of late nights and countless revisions, the essay is finally sent. This is not loud, celebratory feeling; it is quiet, deep peace. The satisfaction comes not from external validation, but knowing you gave everything you had to craftsmanship.',
    tags: ['creativity', 'work', 'deep-work'],
    date: '28/10/2025',
    starred: true,
  },
  {
    id: 'fragment-5',
    type: 'idea',
    title: 'Marginalia as conversational partner',
    content: 'Instead of passive highlighting, treat reading as an argumentative dialogue. Write questions directly in the margins as though the author were sitting across the library table from you.',
    tags: ['reading', 'inquiry', 'method'],
    date: '19/09/2025',
    source: 'Adler research notes',
    starred: false,
  },
  {
    id: 'fragment-6',
    type: 'reference',
    title: 'Brass compass from Kyoto antiquary',
    content: 'Small, weathered brass casing with a gently trembling needle. Reminds me that while our paths shift with the terrain, orientation is an internal compass.',
    tags: ['travel', 'direction', 'artifacts'],
    date: '04/08/2025',
    source: 'Kyoto Teramachi antiquary',
    starred: false,
  },
];

export const INITIAL_RELICS = INITIAL_FRAGMENTS;

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj-1',
    title: 'The Architecture of Solitude',
    description: 'A three-part philosophical essay exploring domestic sanctuaries, reading rooms, and cognitive retreats across centuries.',
    status: 'drafting',
    progress: 68,
    targetWordCount: 5000,
    currentWordCount: 3420,
    deadline: 'March 15, 2026',
    noteIds: ['note-1', 'note-6'],
    milestones: [
      { id: 'm1', title: 'Compile historical library archetypes', completed: true },
      { id: 'm2', title: 'Draft Montaigne and Seneca comparative section', completed: true },
      { id: 'm3', title: 'Complete Part II: The Modern Distraction Machine', completed: false },
      { id: 'm4', title: 'Final copyedit and reading rhythm polish', completed: false },
    ],
  },
  {
    id: 'proj-2',
    title: 'Noesis System Specification',
    description: 'Comprehensive design system documentation, token dictionary, and interaction principles for mindful personal software.',
    status: 'in_progress',
    progress: 85,
    targetWordCount: 3000,
    currentWordCount: 2550,
    deadline: 'February 28, 2026',
    noteIds: ['note-2', 'note-5'],
    milestones: [
      { id: 'm2-1', title: 'Finalize parchment and antique charcoal color tokens', completed: true },
      { id: 'm2-2', title: 'Design 3-column desktop and mobile drawer navigation', completed: true },
      { id: 'm2-3', title: 'Complete Tiptap rich-text typography styling', completed: true },
      { id: 'm2-4', title: 'Cross-device touch audit', completed: false },
    ],
  },
  {
    id: 'proj-3',
    title: 'Letters to a Young Synthesizer',
    description: 'Short epistles on learning in public, building digital gardens, and protecting deep attention.',
    status: 'review',
    progress: 40,
    targetWordCount: 4000,
    currentWordCount: 1600,
    deadline: 'April 30, 2026',
    noteIds: ['note-3', 'note-4'],
    milestones: [
      { id: 'm3-1', title: 'Letter 1: On the Illusion of Information', completed: true },
      { id: 'm3-2', title: 'Letter 2: Cultivating your Private Museum', completed: false },
      { id: 'm3-3', title: 'Letter 3: Writing as an Epistemic Scalpel', completed: false },
    ],
  },
];
