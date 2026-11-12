# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Electron desktop app; renderer is a web surface. Not native design language.)

## Users
Anyone with a PDF and a home printer: home readers who want books and papers on paper, hobby bookbinders who care about signatures, folds and spines, and students/researchers printing cheap readable drafts.

## Product Purpose
Turn a PDF into a print-ready booklet: reorder pages for stitched (saddle) or perfect binding, print a two-up optimized draft, or margins-only. Trim dead margins so text prints larger, drop pages, and proof every sheet before spending paper. Success: the first print job comes out right.

## Positioning
Local, offline imposition tool with a sheet-by-sheet proof and direct printing from memory — the numbers that decide the print job (sheets, sides, blanks, duplex flip, trim) always in view.

## Operating Context
Desktop, at a home printer. User drops a PDF, picks a binding mode, sets paper/margins/signature size, steps through sheets front and back, prints (Ctrl/Cmd+P) or exports. Page removal via contact sheet and ranges; Ctrl/Cmd+Z undo.

## Capabilities and Constraints
- Offline by construction: renderer runs under `default-src 'self'`, no network requests. Fonts and assets must be local files (fonts declared inline in `src/renderer/index.html`, not in CSS — Bun inlines small url() assets as data: URIs which the CSP blocks).
- Only outbound call: update check, switchable off.
- Four modes: stitched, perfect binding, optimized draft, margins-only.
- Paper: A4, Letter, Legal, A3, Tabloid, A5.

## Brand Commitments
Name "Perfect Binding"; icons in `assets/icons/`. Editorial/magazine character is wanted, but expressed through real print-shop craft rather than stock editorial templates.

## Evidence on Hand
README screenshots in `assets/screenshots/`. No testimonials or usage numbers; do not fabricate any.

## Product Principles
1. Proof before paper: show exactly what will print.
2. The print-job numbers are always visible.
3. Nothing leaves the machine.
4. Speak the language of printing and binding precisely.
