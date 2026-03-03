# UI Primitives Guide

This project uses ShadCN UI + Tailwind as the base design system.

## Registered Primitives

- `Button` (`src/components/ui/button.tsx`)
- `Card` (`src/components/ui/card.tsx`)
- `Input` (`src/components/ui/input.tsx`)
- `Label` (`src/components/ui/label.tsx`)
- `Textarea` (`src/components/ui/textarea.tsx`)
- `Badge` (`src/components/ui/badge.tsx`)
- `Dialog` (`src/components/ui/dialog.tsx`)
- `Table` (`src/components/ui/table.tsx`)
- `Form` helpers (`src/components/ui/form.tsx`)
- `Toaster` (`src/components/ui/sonner.tsx`)

## Form-heavy Workflow Conventions

- Use `.page-section` for each major form section/container.
- Use `.form-grid` for 2-column responsive form layout.
- Use `.field-stack` to keep label/input/hint/error spacing consistent.
- Use `.field-hint` for guidance text below fields.
- Use `.field-error` for validation error text.
- Keep state styling consistent via focus ring tokens (`ring`, `ring-offset-background`) already configured globally.

## Typography and Spacing Conventions

- Headings use base typography scale from `src/index.css` (`h1`, `h2`, `h3`).
- Page-level vertical rhythm uses `space-y-*` classes via `.page-shell`.
- Prefer existing tokenized colors (`background`, `foreground`, `muted`, `destructive`, etc.) over ad-hoc values.
