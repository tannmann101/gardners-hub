# Notes Workspace

Private gallery of works at `/notes/`. Static and data-driven: no build step,
no backend. Every word on these pages comes from a JSON file. The `.js` and
`.css` files only handle layout.

```
notes/
  index.html               works index (reads works.json)
  works.json               registry: intro text + one entry per work
  notes.css                shared look for the workspace
  timeline.js              renderer for timeline-type works
  paradigm-timeline/
    index.html             thin shell, points timeline.js at data.json
    data.json              the work itself, the only file you edit to revise it
```

Every page carries `noindex, nofollow, noarchive` meta tags. There is no
sitemap, and there is deliberately no robots.txt entry (a Disallow line would
advertise the path and stop crawlers from seeing the noindex).

## Revising the Working Paradigm Timeline

Edit `paradigm-timeline/data.json`, then bump `lastRevised` and set
`revisionNote`. Rules the page follows:

- **`null` or `""` anywhere renders as "not yet sorted"**, muted but visible.
  Never fill a field just to make it look complete.
- Any `flag` string (for example `"proposed with Claude, not yet confirmed by me"`)
  shows as a dashed gold badge. Remove the flag when you confirm the value.
- `refs` are lists of entry ids (`"1"`, `"22"`, `"A"`, `"M2"`). They render
  as links that open that entry.

### One paradigm (`paradigms[]`, `tracks[]`, `met[]`)

| field | meaning |
|---|---|
| `id` | display number: `"1"`–`"24"`, `"A"`/`"B"` for tracks, `"M1"`… for met |
| `log` | your log number (kept for reference, not shown) |
| `slug` | anchor in the URL: `/notes/paradigm-timeline/#the-baptist-church`. Don't change it once shared |
| `era` | `childhood`, `teens`, `adulthood` (tracks: band they run in; met: `met`) |
| `title`, `kind`, `kindNote` | `kind` is `inherited`, `mine`, or `met` |
| `period` | free text, as you'd say it |
| `placementUncertain` | text describing the uncertainty, or `null` |
| `alsoIn` | later bands it's still running in, e.g. `["adulthood"]` (draws a "Still running" row there) |
| `status.value` | `ended`, `ongoing`, `ongoing-not-held`, or `null`; `status.note` is your wording |
| `tests.salvific` | `{ value: "salvific" \| "worldly" \| null, note, flag }` |
| `tests.reason` | `{ value: "ratio" \| "logos" \| null, note, flag }` |
| `tests.boundary` | `{ text, flag, refs }`. `text: null` means not yet sorted |
| `overview` | list of paragraphs, first person |
| `relevant` | `[{ text, refs }]`; tracks also have `items` (plain list) |
| `shifts.in` / `shifts.out` | `[{ text, refs }]` specific to this entry |
| `livingDefinition` | text that develops over time |
| `openQuestions` | list of strings |
| `track` (tracks only) | `{ label, startsAt: "<entry id>" \| null, startNote }` |

To add a paradigm, copy an existing one, give it a new `id` and `slug`, and
place it in the array in chronological order. Order in the file is order on
the page.

### Shifts and open items

`shiftsNoticed[]` and `openItems[]` are `{ text, refs, flag? }`. A shift can
also carry `from: [ids]` and `to: [ids]`. It then appears under "Out" on the
`from` entries and under "In" on the `to` entries. Otherwise it appears under
"Also noticed" on every entry in `refs`.

## Adding a new work

1. Make `notes/<slug>/data.json` with at least `title`, `subtitle`,
   `lastRevised`, `revisionNote`.
2. Make `notes/<slug>/index.html`. For a timeline, copy
   `paradigm-timeline/index.html` and change the title and `data-src`. A
   different form (essay, map, table) gets its own renderer next to
   `timeline.js`.
3. Add `{ "slug", "href", "data", "form" }` to `works.json`.

Data files are fetched with `no-cache`, so edits show up on the next load.
If you change `notes.css` or `timeline.js`, bump the `?v=` on their tags in
the HTML shells, because Cloudflare caches those.
