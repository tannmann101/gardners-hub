# Interviews: filling in a work over time

Works in the Notes Workspace are revised by interview: Claude asks, Tanner
answers in his own words, and the answers go back into the work's
`data.json`. Start a session by pasting a prompt from the page's **Gaps**
view ("Copy interview prompt"), or by saying which entries to cover.

## How Claude runs a session

1. **One question at a time.** Start with what the Gaps view lists for the
   chosen entries. Dates and placement first, then status and the sorting
   tests, then open questions.
2. **His words, not mine.** Record answers in his wording. Don't invent,
   embellish, correct, tidy up, or add outside facts (people, history,
   theology, or dates such as when a public event happened). If I
   suggest a reading, it goes in with a flag such as
   `"proposed with Claude, not yet confirmed by me"` until he confirms it.
3. **Unknown stays unknown.** "Not sure" means the field stays `null`. Never
   fill a field to make it look complete.
4. **Religious material** is treated with sincerity: no irony, no flourish.
5. **Read back before writing.** At the end, show what will change, field by
   field, and wait for an OK.

## Writing it back (`data.json`)

- **Dates** go in `dates.start` / `dates.end` on the entry. A date point is
  any of:
  ```json
  { "year": 2014, "month": 8, "day": 15, "approx": false, "text": "the summer before senior year" }
  { "age": 8, "ageTo": 9, "approx": true, "text": "around age 8-9" }
  ```
  Use `year` when he gives a calendar year, `age` when he gives how old he
  was, `approx: true` for "around" or "about", and `text` for how he said it
  (the page shows `text` first). If he gives his birth year, set top-level
  `birthYear` so the chart can convert ages to years.
- **Status and tests:** `status.value`, `tests.salvific.value`,
  `tests.reason.value`, `tests.boundary.text`, plus notes in his words.
  Remove a `flag` once he confirms it.
- **Answered open questions:** move the answer into the right field and
  remove the question from `openQuestions` (and from top-level `openItems`
  if it's listed there).
- **New shifts he notices:** add to `shiftsNoticed` with `refs` (and
  `from`/`to` if it's a move from one entry to another).
- **Log the session:** append to `interviews`:
  ```json
  { "date": "2026-11-08", "summary": "Dated entries 11–15; boundary for 12.", "entries": ["11","12","13","14","15"] }
  ```
- **Revise:** push the old `{ "date": lastRevised, "note": revisionNote }`
  onto `revisions`, then set `lastRevised` to today and `revisionNote` to a
  short line in his words.

Then commit, push, and (if he says so) merge. The page code never needs to
change for an interview.
