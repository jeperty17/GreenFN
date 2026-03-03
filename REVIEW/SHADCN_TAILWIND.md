# ShadCN + Tailwind Task Review

## Summary

This task integrated Tailwind CSS and ShadCN UI into `greenfn-web`, established design tokens and utility conventions, generated reusable UI primitives, and verified compatibility through build/lint checks.

## Commands to Reproduce / Run

From repository root:

```bash
cd greenfn-web
npm install
npm run dev
```

Verification checks:

```bash
cd greenfn-web
npm run build
npm run lint
```

## Commands to Check Visible Effects

Run server first (`npm run dev`), then open core routes (layout/nav now uses Tailwind tokenized styling):

```bash
open http://localhost:5173/
open http://localhost:5173/pipeline
open http://localhost:5173/today
open http://localhost:5173/interaction-history
open http://localhost:5173/ai-summary
```

Quick static checks for key setup files:

```bash
ls -la greenfn-web/src/components/ui
cat greenfn-web/components.json
cat greenfn-web/tailwind.config.cjs
cat greenfn-web/postcss.config.cjs
```

## File Type Rundown (What was created)

- **Style system config files** (`tailwind.config.cjs`, `postcss.config.cjs`, `components.json`): define Tailwind scanning/theme and ShadCN registry config.
- **Design/token stylesheet** (`src/index.css`): centralizes theme variables, base typography, and reusable form/page utility classes.
- **Reusable UI primitive components** (`src/components/ui/*`): provide standardized buttons, cards, inputs, dialogs, tables, forms, badges, and toaster.
- **Utility/helper modules** (`src/lib/utils.ts`): shared helper for class merging (`cn`) used by generated components.
- **Documentation file** (`docs/ui-primitives.md`): records available primitives and usage conventions for future feature work.
