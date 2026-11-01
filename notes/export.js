/* Notes Workspace: shared helpers for getting a work out of the page.
   - Markdown export of a whole work or one entry
   - date formatting for the optional `dates` fields
   - "gaps": what is still missing per entry, phrased as interview prompts
   - clipboard and download helpers
   Pure functions over a work's data.json; no page layout here. */
(function () {
  'use strict';

  var NS = 'not yet sorted';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var LABEL = {
    kind: { inherited: 'Inherited', mine: 'Mine', met: 'Met along the way' },
    status: { ended: 'Ended', ongoing: 'Ongoing', 'ongoing-not-held': 'Ongoing but no longer held' },
    salvific: { salvific: 'Salvific', worldly: 'Worldly' },
    reason: { ratio: 'Ratio', logos: 'Logos' }
  };

  function has(v) { return v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''); }
  function arr(v) { return Array.isArray(v) ? v : (has(v) ? [v] : []); }
  function allItems(d) { return (d.paradigms || []).concat(d.tracks || [], d.met || []); }
  function byId(d) { var m = {}; allItems(d).forEach(function (p) { m[p.id] = p; }); return m; }
  function numLabel(item) {
    if (item.track) return item.track.label;
    if (/^\d+$/.test(item.id)) return (item.id.length < 2 ? '0' : '') + item.id;
    return item.id;
  }
  function isoDate(d) {
    var p = String(d || '').split('-');
    if (p.length !== 3) return d;
    return parseInt(p[2], 10) + ' ' + MONTHS[parseInt(p[1], 10) - 1].slice(0, 3) + ' ' + p[0];
  }

  /* ---------- dates ----------
     A date point is null or an object with any of:
       year, month (1-12), day, age, ageTo, approx (bool), text (my words)
     `text` wins for display, since it's how I said it. */
  function fmtPoint(pt) {
    if (!pt) return null;
    if (has(pt.text)) return pt.text;
    var s = '';
    if (pt.year) {
      s = (pt.month ? MONTHS[pt.month - 1] + ' ' : '') + (pt.month && pt.day ? pt.day + ', ' : '') + pt.year;
    } else if (pt.age !== undefined && pt.age !== null) {
      s = 'age ' + pt.age + (pt.ageTo ? '–' + pt.ageTo : '');
    } else return null;
    return (pt.approx ? 'about ' : '') + s;
  }
  function hasPoint(pt) { return !!(pt && (pt.year || (pt.age !== undefined && pt.age !== null))); }
  function fmtSpan(item) {
    var d = item.dates || {};
    var st = item.status && item.status.value;
    if (!hasPoint(d.start) && !hasPoint(d.end)) return null;
    var a = hasPoint(d.start) ? fmtPoint(d.start) : 'start not yet dated';
    var b = hasPoint(d.end) ? fmtPoint(d.end) : (st === 'ongoing' || st === 'ongoing-not-held' ? 'ongoing' : 'end not yet dated');
    return a + ' → ' + b;
  }

  /* ---------- gaps (interview prompts) ---------- */
  function gaps(item) {
    var g = [];
    var d = item.dates || {};
    var st = item.status && item.status.value;
    var t = item.tests || {};
    var met = item.kind === 'met';
    if (!hasPoint(d.start)) g.push({ field: 'dates', prompt: 'When did this begin? A year if I know it, or how old I was.' });
    if (!hasPoint(d.end) && st === 'ended') g.push({ field: 'dates', prompt: 'When did it end? A year, or how old I was.' });
    if (!has(item.period) && !hasPoint(d.start)) g.push({ field: 'period', prompt: 'Roughly what stretch of my life does this cover?' });
    if (item.placementUncertain) g.push({ field: 'placement', prompt: 'Placement: ' + item.placementUncertain + '.' });
    if (!met) {
      if (!has(st)) g.push({ field: 'status', prompt: 'Status: ended, ongoing, or ongoing but no longer held?' });
      var sv = t.salvific || {}, rv = t.reason || {}, bd = t.boundary || {};
      if (!has(sv.value)) g.push({ field: 'salvific', prompt: 'Salvific or worldly?' });
      else if (sv.flag) g.push({ field: 'salvific', prompt: 'Confirm salvific or worldly: ' + (LABEL.salvific[sv.value] || sv.value) + ' (' + sv.flag + ').' });
      if (!has(rv.value)) g.push({ field: 'reason', prompt: 'Ratio or Logos?' });
      else if (rv.flag) g.push({ field: 'reason', prompt: 'Confirm ratio or Logos: ' + (LABEL.reason[rv.value] || rv.value) + ' (' + rv.flag + ').' });
      if (!has(bd.text)) g.push({ field: 'boundary', prompt: 'Boundary: who is inside it, and who is excluded?' });
      else if (bd.flag) g.push({ field: 'boundary', prompt: 'Confirm the boundary (' + bd.flag + ').' });
    }
    // Skip open questions that just restate a gap already listed above.
    var listed = {}; g.forEach(function (x) { listed[x.field] = true; });
    var restates = {
      'salvific or worldly, and ratio or logos.': listed.salvific || listed.reason,
      'ratio or logos.': listed.reason,
      'confirm logos.': listed.reason,
      'boundary test.': listed.boundary
    };
    arr(item.openQuestions).forEach(function (q) {
      var k = String(q).trim().toLowerCase();
      if (restates[k]) return;
      if (/^placement:/.test(k) && listed.placement) return;
      g.push({ field: 'open', prompt: 'Open: ' + q });
    });
    if (!met && !has(item.livingDefinition)) g.push({ field: 'living', prompt: 'Living definition: not written yet. Is there a line forming?', minor: true });
    return g;
  }

  /* ---------- Markdown ---------- */
  function flagMd(f) { return f ? ' *[' + f + ']*' : ''; }
  function refsMd(refs, ids) {
    if (!refs || !refs.length) return '';
    return ' (→ ' + refs.map(function (r) { var t = ids[r]; return t ? (t.track ? t.title : r) : r; }).join(', ') + ')';
  }
  function val(v, labels) { return has(v) ? (labels[v] || v) : NS; }

  function itemMd(d, item, level) {
    var ids = byId(d);
    var h = new Array((level || 3) + 1).join('#');
    var L = [];
    L.push(h + ' ' + numLabel(item) + ' · ' + item.title);
    L.push('');
    var st = item.status || {}, t = item.tests || {};
    var sv = t.salvific || {}, rv = t.reason || {}, bd = t.boundary || {};
    L.push('- **Kind:** ' + (LABEL.kind[item.kind] || item.kind) + (has(item.kindNote) ? ', ' + item.kindNote : ''));
    L.push('- **Period:** ' + (has(item.period) ? item.period : NS) + (item.placementUncertain ? ' *[placement uncertain]*' : ''));
    L.push('- **Dates:** ' + (fmtSpan(item) || NS));
    L.push('- **Status:** ' + val(st.value, LABEL.status) + (has(st.note) ? ': ' + st.note : ''));
    L.push('- **Salvific or worldly:** ' + val(sv.value, LABEL.salvific) + flagMd(sv.flag) + (has(sv.note) ? ': ' + sv.note : ''));
    L.push('- **Ratio or Logos:** ' + val(rv.value, LABEL.reason) + flagMd(rv.flag) + (has(rv.note) ? ': ' + rv.note : ''));
    L.push('- **Boundary:** ' + (has(bd.text) ? bd.text : NS) + flagMd(bd.flag) + refsMd(bd.refs, ids));
    L.push('');
    L.push('**Overview**');
    L.push('');
    var ov = arr(item.overview);
    L.push(ov.length ? ov.join('\n\n') : '_' + NS + '_');
    L.push('');
    var rel = [];
    arr(item.items).forEach(function (x) { rel.push('- ' + x); });
    arr(item.relevant).forEach(function (x) { rel.push('- ' + x.text + flagMd(x.flag) + refsMd(x.refs, ids)); });
    L.push('**Relevant items**');
    L.push('');
    L.push(rel.length ? rel.join('\n') : '_' + NS + '_');
    L.push('');
    var sh = item.shifts || {};
    var ins = arr(sh['in']).slice(), outs = arr(sh.out).slice(), noted = [];
    arr(d.shiftsNoticed).forEach(function (s) {
      if ((s.to || []).indexOf(item.id) > -1) ins.push(s);
      else if ((s.from || []).indexOf(item.id) > -1) outs.push(s);
      else if ((s.refs || []).indexOf(item.id) > -1) noted.push(s);
    });
    function shiftList(lab, xs) {
      L.push('*' + lab + ':* ' + (xs.length ? '' : '_' + NS + '_'));
      xs.forEach(function (x) { L.push('- ' + x.text + flagMd(x.flag) + refsMd(x.refs, ids)); });
    }
    L.push('**Shifts**');
    L.push('');
    shiftList('In', ins);
    shiftList('Out', outs);
    if (noted.length) shiftList('Also noticed', noted);
    L.push('');
    L.push('**Living definition**');
    L.push('');
    L.push(has(item.livingDefinition) ? item.livingDefinition : '_' + NS + '_');
    L.push('');
    L.push('**Open questions**');
    L.push('');
    var oq = arr(item.openQuestions);
    L.push(oq.length ? oq.map(function (q) { return '- ' + q; }).join('\n') : '_' + NS + '_');
    L.push('');
    return L.join('\n');
  }

  function workMd(d) {
    var L = [];
    L.push('# ' + d.title);
    L.push('');
    if (has(d.subtitle)) { L.push('_' + d.subtitle + '_'); L.push(''); }
    L.push('Last revised: ' + (has(d.lastRevised) ? isoDate(d.lastRevised) : NS) + '  ');
    L.push('Revision note: ' + (has(d.revisionNote) ? d.revisionNote : NS));
    L.push('');
    if (d.definition) {
      L.push('## ' + (d.definition.heading || 'Working definition'));
      L.push('');
      L.push(arr(d.definition.paragraphs).join('\n\n'));
      if (has(d.definition.note)) { L.push(''); L.push('(' + d.definition.note + ')' + flagMd(d.definition.noteFlag)); }
      L.push('');
    }
    if (d.tests && d.tests.length) {
      L.push('## Sorting tests');
      L.push('');
      d.tests.forEach(function (t) { L.push('- **' + t.name + ':** ' + t.text); });
      if (d.sources && has(d.sources.text)) { L.push(''); L.push('**Outside sources**' + flagMd(d.sources.flag) + ': ' + d.sources.text); }
      L.push('');
    }
    (d.eras || []).forEach(function (era) {
      L.push('## ' + era.name);
      L.push('');
      (d.paradigms || []).filter(function (p) { return p.era === era.key; }).forEach(function (p) { L.push(itemMd(d, p, 3)); });
    });
    if ((d.tracks || []).length) {
      L.push('## Running tracks');
      L.push('');
      d.tracks.forEach(function (p) { L.push(itemMd(d, p, 3)); });
    }
    if ((d.met || []).length) {
      L.push('## Met along the way');
      L.push('');
      d.met.forEach(function (p) { L.push(itemMd(d, p, 3)); });
    }
    var ids = byId(d);
    [['Shifts noticed', d.shiftsNoticed], ['Open', d.openItems]].forEach(function (s) {
      L.push('## ' + s[0]);
      L.push('');
      var xs = arr(s[1]);
      L.push(xs.length ? xs.map(function (x) { return '- ' + x.text + flagMd(x.flag) + refsMd(x.refs, ids); }).join('\n') : '_' + NS + '_');
      L.push('');
    });
    if (arr(d.interviews).length) {
      L.push('## Interviews');
      L.push('');
      d.interviews.forEach(function (i) { L.push('- ' + isoDate(i.date) + ': ' + (i.summary || '') + refsMd(i.entries, ids)); });
      L.push('');
    }
    if (arr(d.revisions).length) {
      L.push('## Revision history');
      L.push('');
      d.revisions.forEach(function (r) { L.push('- ' + isoDate(r.date) + ': ' + (has(r.note) ? r.note : NS)); });
      L.push('');
    }
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  /* ---------- interview prompt ---------- */
  function interviewPrompt(d, items, opts) {
    opts = opts || {};
    var L = [];
    L.push('Let’s continue the interview for my “' + d.title + '” (Notes Workspace on thegardners.xyz).');
    if (opts.dataPath) L.push('The data lives in ' + opts.dataPath + ' in the tannmann101/gardners-hub repo; follow notes/INTERVIEW.md.');
    L.push('Ask me one question at a time. Keep my wording. Don’t invent, embellish, correct, or add outside facts. Mark anything you suggest as proposed with Claude until I confirm it. When we stop, update the data file, add an entry to "interviews", and bump lastRevised and revisionNote.');
    L.push('');
    L.push('Entries to cover:');
    items.forEach(function (item) {
      var g = gaps(item);
      L.push('');
      L.push('## ' + numLabel(item) + ' · ' + item.title + ' (#' + item.slug + ')');
      L.push('');
      L.push('Still missing:');
      L.push(g.length ? g.map(function (x) { return '- ' + x.prompt; }).join('\n') : '- nothing listed');
      if (opts.withEntries !== false) {
        L.push('');
        L.push('Current entry:');
        L.push('');
        L.push(itemMd(d, item, 3));
      }
    });
    return L.join('\n').replace(/\n{3,}/g, '\n\n');
  }

  /* ---------- clipboard / download ---------- */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
      catch (e) { reject(e); }
      document.body.removeChild(ta);
    });
  }
  function download(filename, text, type) {
    var blob = new Blob([text], { type: (type || 'text/plain') + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  window.NotesExport = {
    NS: NS, LABEL: LABEL, has: has, numLabel: numLabel, isoDate: isoDate,
    fmtPoint: fmtPoint, fmtSpan: fmtSpan, hasPoint: hasPoint,
    gaps: gaps, itemMd: itemMd, workMd: workMd, interviewPrompt: interviewPrompt,
    copyText: copyText, download: download, allItems: allItems
  };
})();
