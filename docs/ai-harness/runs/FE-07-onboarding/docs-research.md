# FE-07 オンボーディング: docs research

## Sources consulted

- Saved canonical task snapshot: FE-07 requires household count, age groups, care needs, pets, car, and address; saving/re-display depends on BE-09 and DS-06. BE-09 and BE-10 are unstarted.
- Notion `03_要件定義`: household count/age, usual locations, car, pets, and support needs are registered information; exact address and individual sensitive details are not public.
- Notion `04_UI画面設計`: family composition and home information registration is a resident-facing screen.
- Notion MN-1: only initial user/household creation is implemented; pets, care needs, and household CRUD are explicitly out of scope.
- Figma file metadata: relevant frames are `page2` login (`7:945`), `page1` (`7:683`), `page3` (`7:1230`), `page4` (`92:472`), `page5 1/2` (`92:510`, `92:1587`), `page6 1/2` (`92:818`, `94:2004`), `page7 1/2` (`92:1709`, `94:2031`), and `page8` (`92:1905`).
- User-provided Figma screenshot: confirmed the visible sequence, copy, choice groups, address sections, progress treatment, bottom primary actions, and selected-state variants.
- Bundled Next.js 16 Proxy/form guidance and existing repository patterns.

## Source limitations and conflicts

- Individual Figma `get_design_context` and screenshot calls were attempted after loading the mandatory skill but were rejected because the connected Figma Starter plan reached its MCP call limit. Exact spacing/dimensions are therefore not invented; implementation uses the supplied screenshot and existing design tokens.
- Figma asks for postal/current-location input, while repository security design forbids storing exact address and BE-10 address conversion does not exist. This sprint collects draft input in memory only and records a backend handoff.

## Sources skipped

- Miro: the user supplied the exact eight-step order, and Figma metadata/screenshot plus Notion make the page sequence unambiguous.
