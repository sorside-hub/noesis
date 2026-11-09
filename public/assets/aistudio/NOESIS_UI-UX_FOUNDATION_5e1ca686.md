---
title: "NOESIS UI/UX FOUNDATION"
date: 2026-11-09T00:40:54.271Z
---

We are starting Phase 1 of Noesis development.

The scope of this phase is STRICTLY limited to frontend design, layout, visual identity, and user interface implementation.

IMPORTANT: Do not implement any backend functionality.

## 1\. Scope Restrictions

Do NOT implement:

- Database.
- Supabase.
- Authentication.
- Backend services.
- AI integration.
- API integrations.
- Semantic search.
- Embeddings.
- Actual data persistence.

Use static mock data and local React state exclusively for frontend demonstrations.

## 2\. Design Direction

Create a minimalist editorial interface inspired by the provided sorside website screenshot.

The visual identity should feature:

- Warm, refined editorial aesthetics.
- Serif headings.
- Readable sans-serif body typography.
- Generous whitespace.
- Subtle separators and borders.
- Minimal decorative elements.
- Clear visual hierarchy.

The application should feel like a personal intellectual workspace, not a generic SaaS dashboard.

## 3\. Theme System

Implement:

- Light theme.
- Dark theme.
- System theme preference.

Use centralized CSS variables and semantic design tokens.

Never hardcode colors directly into components.

Both themes must be intentionally designed and consistently applied.

## 4\. Responsive Layout

Design for desktop, tablet, and mobile.

Desktop:

- Sidebar navigation.
- Main content area.
- Optional secondary panels when appropriate.

Mobile:

- Bottom navigation.
- Single-column content.
- Full-screen note editor.
- Touch-friendly controls.
- Responsive dialogs and toolbars.

Do not simply scale down desktop layouts.

## 5\. Pages to Design

Create the following pages:

1. Home / Overview.
2. Capture.
3. Knowledge Library.
4. Note Editor.
5. Discover.
6. Projects.
7. Settings.

All pages must share a consistent design system and navigation structure.

Use realistic mock content for visual demonstrations.

Do not present mock functionality as real backend functionality.

## 6\. Rich Text Editor

Use Tiptap as the Rich Text Editor.

Implement the frontend editor with:

- Title.
- Rich text content.
- Heading levels.
- Bold and italic.
- Bullet and numbered lists.
- Blockquotes.
- Links.
- Images interface.
- Minimal formatting toolbar.
- Floating bubble menu where appropriate.
- Responsive mobile toolbar.

Use local React state for editing demonstrations.

Do not connect the editor to a database.

## 7\. Design System

Define:

- Typography scale.
- Spacing system.
- Color tokens.
- Border and radius conventions.
- Reusable buttons.
- Inputs.
- Navigation components.
- Dialogs.
- Dropdowns.
- Cards and list components.
- Responsive breakpoints.

Maintain consistent visual language across all pages.

## 8\. Current Task

First, inspect the existing project structure and dependencies.

Then prepare a detailed implementation plan covering:

1. Application layout.
2. Navigation architecture.
3. Page-by-page design.
4. Desktop and mobile behavior.
5. Tiptap integration.
6. Component architecture.
7. Theme architecture.
8. Required dependencies.
9. Implementation sequence.

Identify potential technical conflicts with the existing project.

Do not modify files or execute implementation yet.

Present the plan for review and approval.
