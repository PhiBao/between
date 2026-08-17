---
name: evidence-pack-review
description: Checklist for reviewing the exported evidence pack before a release. Use when changing the pack builder, the PDF renderer, the verify page, or anything that writes to the record.
---

# Reviewing the evidence pack

The pack is the artefact a parent hands to a solicitor or a mediator. If it is
wrong, misleading, or over-claims, it can hurt someone in a custody dispute. It
gets reviewed as a document, not as a code path.

## 1. Produce one against real data

```bash
pnpm seed                 # rebuild the demo record
pnpm build && pnpm start
curl -s -o /tmp/pack.pdf -b cookies.txt http://localhost:3000/pack/download
```

Or sign in as `alex@between.demo` and use the Pack tab. Open the PDF.

## 2. Check the document as a reader would

- [ ] Does the header state when it was generated and the exact period covered?
- [ ] Are both parents named, and the children listed?
- [ ] Is every message present, in order, with its sequence number, author,
      timestamp and hash?
- [ ] Is a logged-from-outside message clearly labelled as logged by a parent
      rather than delivered through the app?
- [ ] Does every agreement show its source quote and its full history with actors
      and dates?
- [ ] Is the integrity section unambiguous about what it does and does not prove?
- [ ] Does the document avoid any claim about admissibility, and any legal or
      parenting advice?
- [ ] Are the page numbers right, and is nothing clipped or overlapping?

## 3. Check the awkward inputs

- [ ] A message with curly quotes, an em dash and an emoji renders without
      throwing (standard PDF fonts are WinAnsi; the sanitiser handles this).
- [ ] A 4000-character message wraps and breaks across pages correctly.
- [ ] A single unbroken 300-character string does not overflow the margin.
- [ ] A record with no agreements says so rather than leaving an empty section.
- [ ] Exporting an empty record returns a clear error, not a blank PDF.

## 4. Check that verification actually verifies

- [ ] The head hash in the PDF matches the one on the Pack page.
- [ ] Pasting it into `/verify` in a signed-out browser reports "This pack verifies".
- [ ] Tampering with a message body in the database makes `/verify` report
      altered, naming the sequence number.
- [ ] The verify response still reveals nothing but a verdict, a count and dates.

## 5. Confirm nothing is gated

- [ ] The pack is free, complete, and needs no upgrade prompt.
- [ ] It includes agreements that are unflattering to the exporting parent —
      a one-sided record is worthless, and quietly filtering would be a lie.
