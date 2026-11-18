# Licenses of the tech logos

These 16 SVG files are the logos the CV (https://www.kairomx.tech/cv/) shows in its stack section,
copied unchanged from the CV's own files, which were downloaded from the libraries listed below.

- Brand logos are trademarks of their respective owners. The license (CC0, MIT) covers the SVG
  file, not the trademark. They are used only nominatively, to say that these technologies are part
  of the stack, with no claim of sponsorship or endorsement.
- The drawings are not edited. Three of them (Next.js, Expo, Vercel) are the light single-color
  variants the brands publish, recolored to #f3f1ea by the CV (column "Recolor").
- How the README shows them: in gray, through an SVG filter that changes how the logo is painted,
  not the file. Dark theme: the CV's rest filter, grayscale(1) brightness(1.15) contrast(.85) at 60 %
  opacity; for seven darker drawings (TypeScript, Python, PostgreSQL, Git, Docker, n8n, Claude) the
  CV's filter for dark logos, brightness 1.9 instead of 1.15. Light theme: Next.js, Expo and Vercel
  are inverted, as the CV does; the other thirteen use a filter the CV does not have, the same gray
  at an eighth of the brightness (grayscale(1) brightness(.12) contrast(.85), 60 % opacity), because
  none of the CV's filters reaches 3:1 against the light background. Every logo is measured at 3:1
  or more against its background in both themes (generador/tira.mjs, pruebas/medir.cjs).

| File | Technology | Library | File license | Recolor |
|---|---|---|---|---|
| `typescript.svg` | TypeScript | material-icon-theme | MIT | none |
| `javascript.svg` | JavaScript | material-icon-theme | MIT | none |
| `python.svg` | Python | gilbarbara/logos | CC0-1.0 | none |
| `react.svg` | React | devicon | MIT | none |
| `react-native.svg` | React Native | devicon | MIT | none |
| `nextjs.svg` | Next.js | teenyicons | MIT | #f3f1ea |
| `nodejs.svg` | Node.js | vscode-icons | MIT (brand icons belong to each brand) | none |
| `expo.svg` | Expo | gilbarbara/logos | CC0-1.0 | #f3f1ea |
| `supabase.svg` | Supabase | svgl | MIT (repository); logos are trademarks of their owners | none |
| `postgresql.svg` | PostgreSQL | gilbarbara/logos | CC0-1.0 | none |
| `tailwindcss.svg` | Tailwind CSS | vscode-icons | MIT (brand icons belong to each brand) | none |
| `vercel.svg` | Vercel | radix-icons | MIT | #f3f1ea |
| `git.svg` | Git | vscode-icons | MIT (brand icons belong to each brand) | none |
| `docker.svg` | Docker | gilbarbara/logos | CC0-1.0 | none |
| `n8n.svg` | n8n | gilbarbara/logos | CC0-1.0 | none |
| `claude.svg` | Claude | gilbarbara/logos | CC0-1.0 | none |

## Notices of the MIT-licensed libraries

The MIT license asks that its copyright notice and permission notice go with every copy. The files
above come from six MIT-licensed libraries:

| Library | Files here |
|---|---|
| material-icon-theme | `typescript.svg`, `javascript.svg` |
| devicon | `react.svg`, `react-native.svg` |
| teenyicons | `nextjs.svg` |
| vscode-icons | `nodejs.svg`, `tailwindcss.svg`, `git.svg` |
| svgl | `supabase.svg` |
| radix-icons | `vercel.svg` |

Copyright notice of each library: MISSING. The sources these files were copied from record the
library and its license but not the copyright line, and it is not copied here from memory. Before
this README is published, each line must be copied from that library's own LICENSE file:

- material-icon-theme: Copyright (c) [MISSING]
- devicon: Copyright (c) [MISSING]
- teenyicons: Copyright (c) [MISSING]
- vscode-icons: Copyright (c) [MISSING]
- svgl: Copyright (c) [MISSING]
- radix-icons: Copyright (c) [MISSING]

Permission notice (the MIT license text, the same for the six):

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
> associated documentation files (the "Software"), to deal in the Software without restriction,
> including without limitation the rights to use, copy, modify, merge, publish, distribute,
> sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or
> substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT
> NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
> NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
> OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
> CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The CC0-1.0 files (gilbarbara/logos) need no notice.
