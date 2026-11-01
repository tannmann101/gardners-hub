/* Notes Workspace: timeline renderer.
   Reads a work's data.json (path in #work[data-src]) and draws it.
   All wording comes from the data file. This file decides layout only,
   so changing the work never means editing this file.
   Anything missing in the data renders as "not yet sorted". */
(function () {
  'use strict';

  var root = document.getElementById('work');
  if (!root) return;

  var NS = 'not yet sorted';
  var LABEL = {
    kind: { inherited: 'Inherited', mine: 'Mine', met: 'Met along the way' },
    status: { ended: 'Ended', ongoing: 'Ongoing', 'ongoing-not-held': 'Ongoing but no longer held' },
    salvific: { salvific: 'Salvific', worldly: 'Worldly' },
    reason: { ratio: 'Ratio', logos: 'Logos' }
  };
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var X = window.NotesExport;
  var dataPath = root.getAttribute('data-src');
  var data, byId = {}, bySlug = {}, cards = [], carries = [], eraSections = [];
  var views = {}, viewBtns = {}, currentView = 'entries', toastEl;
  var state = { kind: 'all', status: 'all', test: 'any', met: true };

  /* ---------- small helpers ---------- */
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function has(v) { return v !== null && v !== undefined && !(typeof v === 'string' && v.trim() === ''); }
  function unsorted() { return el('span', 'unsorted', NS); }
  function flag(text) { return el('span', 'flag', text); }
  function shortFlag(text) {
    var t = (text || '').toLowerCase();
    if (t.indexOf('proposed') > -1) return 'proposed';
    if (t.indexOf('unconfirmed') > -1) return 'unconfirmed';
    return 'with Claude';
  }
  function fmtDate(d) {
    if (!d) return null;
    var p = String(d).split('-');
    if (p.length !== 3) return d;
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(p[1], 10) - 1];
    return parseInt(p[2], 10) + ' ' + m + ' ' + p[0];
  }
  function numLabel(item) {
    if (item.track) return item.track.label;
    if (/^\d+$/.test(item.id)) return (item.id.length < 2 ? '0' : '') + item.id;
    return item.id;
  }
  function paras(list, cls) {
    var wrap = el('div', 'prose' + (cls ? ' ' + cls : ''));
    (Array.isArray(list) ? list : [list]).forEach(function (t) { if (has(t)) wrap.appendChild(el('p', null, t)); });
    if (!wrap.childNodes.length) wrap.appendChild(unsorted());
    return wrap;
  }
  function refLinks(refs) {
    if (!refs || !refs.length) return null;
    var span = el('span', 'refs');
    span.appendChild(document.createTextNode('→ '));
    refs.forEach(function (id, i) {
      var t = byId[id];
      if (i) span.appendChild(document.createTextNode(', '));
      if (!t) { span.appendChild(document.createTextNode(id)); return; }
      var a = el('a', 'ref', t.track ? t.title : id);
      a.href = '#' + t.slug;
      a.title = t.title;
      a.setAttribute('aria-label', (t.track ? '' : (t.kind === 'met' ? '' : 'Entry ')) + id + ': ' + t.title);
      span.appendChild(a);
    });
    return span;
  }
  function textWithRefs(tag, cls, obj) {
    var e = el(tag, cls);
    e.appendChild(document.createTextNode(obj.text));
    if (obj.flag) e.appendChild(flag(obj.flag));
    var r = refLinks(obj.refs);
    if (r) { e.appendChild(document.createTextNode(' ')); e.appendChild(r); }
    return e;
  }

  /* ---------- copy / download actions ---------- */
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = '';
    setTimeout(function () { toastEl.textContent = msg; }, 30);
  }
  function actionBtn(label, getText) {
    var b = el('button', 'ghost-btn small', label);
    b.type = 'button';
    b.addEventListener('click', function () {
      X.copyText(getText()).then(function () { toast('Copied to clipboard.'); },
        function () { toast('Couldn\u2019t copy. Try Download instead.'); });
    });
    return b;
  }
  function fileBase() { return dataPath.replace(/\/data\.json$/, '').split('/').pop() || 'work'; }
  function renderToolbar() {
    var bar = el('div', 'nw-tools');
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Take this work elsewhere');
    bar.appendChild(actionBtn('Copy as Markdown', function () { return X.workMd(data); }));
    var md = el('button', 'ghost-btn small', 'Download .md'); md.type = 'button';
    md.addEventListener('click', function () { X.download(fileBase() + '-' + (data.lastRevised || 'undated') + '.md', X.workMd(data), 'text/markdown'); });
    bar.appendChild(md);
    var js = el('button', 'ghost-btn small', 'Download data'); js.type = 'button';
    js.addEventListener('click', function () { X.download(fileBase() + '-' + (data.lastRevised || 'undated') + '.json', JSON.stringify(data, null, 2), 'application/json'); });
    bar.appendChild(js);
    var pr = el('button', 'ghost-btn small', 'Print or PDF'); pr.type = 'button';
    pr.addEventListener('click', function () { window.print(); });
    bar.appendChild(pr);
    toastEl = el('p', 'nw-toast');
    toastEl.setAttribute('role', 'status');
    toastEl.setAttribute('aria-live', 'polite');
    var wrap = el('div');
    wrap.appendChild(bar);
    wrap.appendChild(toastEl);
    return wrap;
  }

  /* ---------- views: Entries / Chart / Gaps ---------- */
  function renderViewSwitch() {
    var nav = el('div', 'nw-views');
    nav.setAttribute('role', 'group');
    nav.setAttribute('aria-label', 'View');
    [['entries', 'Entries'], ['chart', 'Chart'], ['gaps', 'Gaps']].forEach(function (v) {
      var b = el('button', 'nw-view', v[1]);
      b.type = 'button';
      b.setAttribute('aria-pressed', v[0] === currentView ? 'true' : 'false');
      b.addEventListener('click', function () { showView(v[0], true); });
      viewBtns[v[0]] = b;
      nav.appendChild(b);
    });
    return nav;
  }
  function showView(name, updateHash) {
    if (!views[name]) return;
    currentView = name;
    Object.keys(views).forEach(function (k) {
      views[k].hidden = k !== name;
      viewBtns[k].setAttribute('aria-pressed', k === name ? 'true' : 'false');
    });
    if (name === 'chart' && !views.chart.childNodes.length) window.NotesChart.render(data, views.chart);
    if (name === 'gaps' && !views.gaps.childNodes.length) renderGaps(views.gaps);
    if (updateHash && history.replaceState) {
      history.replaceState(null, '', name === 'entries' ? location.pathname + location.search : '#view=' + name);
    }
  }

  function renderGaps(box) {
    var items = X.allItems(data);
    var rows = items.map(function (p) { return { p: p, g: X.gaps(p) }; });
    var counts = {};
    rows.forEach(function (r) { r.g.forEach(function (x) { if (!x.minor) counts[x.field] = (counts[x.field] || 0) + 1; }); });
    var head = el('div', 'group-head');
    head.appendChild(el('h2', null, 'Gaps'));
    head.appendChild(el('p', null, 'What each entry is still missing, phrased as interview questions. Copy a prompt into a chat with Claude, answer in your own words, and the answers go back into the data.'));
    box.appendChild(head);
    var names = { dates: 'dates', period: 'period', placement: 'placement', status: 'status', salvific: 'salvific or worldly', reason: 'ratio or Logos', boundary: 'boundary', open: 'open questions' };
    var sum = el('div', 'chips gap-sum');
    Object.keys(names).forEach(function (k) { if (counts[k]) sum.appendChild(chip(String(counts[k]), 'ns', names[k])); });
    box.appendChild(sum);
    var all = el('div', 'pc-actions');
    all.appendChild(actionBtn('Copy interview prompt for every gap', function () {
      return X.interviewPrompt(data, rows.filter(function (r) { return r.g.length; }).map(function (r) { return r.p; }), { dataPath: dataPath, withEntries: false });
    }));
    box.appendChild(all);
    var ol = el('ol', 'gap-list');
    rows.forEach(function (r) {
      if (!r.g.length) return;
      var li = el('li', 'gap-item');
      var h = el('h3', 'gap-title');
      var a = el('a', null, numLabel(r.p) + ' \u00b7 ' + r.p.title);
      a.href = '#' + r.p.slug;
      h.appendChild(a);
      li.appendChild(h);
      var ul = el('ul', 'plain-list');
      r.g.forEach(function (x) { ul.appendChild(el('li', x.minor ? 'minor' : null, x.prompt)); });
      li.appendChild(ul);
      var act = el('div', 'pc-actions');
      act.appendChild(actionBtn('Copy interview prompt', function () { return X.interviewPrompt(data, [r.p], { dataPath: dataPath }); }));
      li.appendChild(act);
      ol.appendChild(li);
    });
    box.appendChild(ol);
  }

  /* ---------- header + folds ---------- */
  function renderHead() {
    var head = el('header', 'nw-head');
    head.appendChild(el('p', 'mono eyebrow', 'Notes Workspace'));
    head.appendChild(el('h1', 'nw-title', data.title));
    if (has(data.subtitle)) head.appendChild(el('p', 'nw-sub', data.subtitle));
    var meta = el('div', 'nw-meta');
    var r1 = el('div'); r1.appendChild(el('span', 'mono', 'Last revised'));
    if (has(data.lastRevised)) { var t = el('time', null, fmtDate(data.lastRevised)); t.dateTime = data.lastRevised; r1.appendChild(t); } else r1.appendChild(unsorted());
    var r2 = el('div'); r2.appendChild(el('span', 'mono', 'Revision note'));
    r2.appendChild(has(data.revisionNote) ? document.createTextNode(data.revisionNote) : unsorted());
    meta.appendChild(r1); meta.appendChild(r2);
    head.appendChild(meta);
    document.title = data.title + ' — Notes Workspace';
    return head;
  }

  function fold(title, hint, open) {
    var d = el('details', 'fold');
    if (open) d.open = true;
    var s = el('summary');
    s.appendChild(el('span', null, title));
    if (hint) s.appendChild(el('span', 'hint', hint));
    d.appendChild(s);
    var body = el('div', 'fold-body');
    d.appendChild(body);
    return { node: d, body: body, summary: s };
  }

  function renderDefinition() {
    var def = data.definition;
    if (!def) return null;
    var f = fold(def.heading || 'Working definition');
    f.body.appendChild(paras(def.paragraphs));
    if (has(def.note)) {
      var n = el('p', 'fold-note', def.note);
      if (def.noteFlag) n.appendChild(flag(def.noteFlag));
      f.body.appendChild(n);
    }
    return f.node;
  }

  function renderLegend() {
    var f = fold('How these are sorted', 'legend');
    var dl = el('div', 'legend-list');
    (data.tests || []).forEach(function (t) {
      var d = el('div');
      d.appendChild(el('div', 'lg-name', t.name));
      d.appendChild(paras(t.text));
      dl.appendChild(d);
    });
    f.body.appendChild(dl);
    if (data.sources && has(data.sources.text)) {
      var s = el('div');
      var h = el('div', 'lg-name', 'Outside sources');
      if (data.sources.flag) h.appendChild(flag(data.sources.flag));
      s.appendChild(h);
      s.appendChild(paras(data.sources.text));
      f.body.appendChild(s);
    }
    var keys = el('div', 'legend-keys');
    keys.appendChild(el('div', 'lg-name', 'Reading the page'));
    function key(swatchCls, text) {
      var k = el('div');
      if (swatchCls) k.appendChild(el('span', 'swatch ' + swatchCls));
      k.appendChild(document.createTextNode(text));
      keys.appendChild(k);
    }
    key(null, 'Kinds: inherited, mine, or met along the way.');
    key(null, 'A filled dot on the line means ongoing.');
    key('carry', 'A dotted row means a paradigm from an earlier band is still running here.');
    (data.tracks || []).forEach(function (t, i) { key(i ? 'rail-b' : 'rail-a', t.track.label + ': ' + t.title + ', running alongside the timeline.'); });
    var fk = el('div'); fk.appendChild(document.createTextNode('Marked as proposed, unconfirmed, or with Claude:')); fk.appendChild(flag('proposed')); keys.appendChild(fk);
    var nk = el('div'); nk.appendChild(document.createTextNode('Not sorted yet: ')); nk.appendChild(unsorted()); keys.appendChild(nk);
    f.body.appendChild(keys);
    return f.node;
  }

  /* ---------- filters ---------- */
  var countEl, filterHint;
  function chipset(name, legend, options) {
    var fs = el('fieldset');
    fs.appendChild(el('legend', null, legend));
    var set = el('div', 'chipset');
    options.forEach(function (o) {
      var lab = el('label');
      var inp = el('input');
      inp.type = 'radio'; inp.name = 'f-' + name; inp.value = o[0];
      if (state[name] === o[0]) inp.checked = true;
      inp.addEventListener('change', function () { state[name] = inp.value; apply(); });
      lab.appendChild(inp);
      lab.appendChild(el('span', null, o[1]));
      set.appendChild(lab);
    });
    fs.appendChild(set);
    return fs;
  }
  function renderFilters() {
    var f = fold('Filter', '');
    filterHint = f.summary.querySelector('.hint');
    var form = el('form', 'filters');
    form.addEventListener('submit', function (e) { e.preventDefault(); });
    form.appendChild(chipset('kind', 'Kind', [['all', 'All'], ['inherited', 'Inherited'], ['mine', 'Mine'], ['met', 'Met along the way']]));
    form.appendChild(chipset('status', 'Status', [['all', 'All'], ['ended', 'Ended'], ['ongoing', 'Ongoing'], ['ongoing-not-held', 'Ongoing, no longer held'], ['none', 'Not yet sorted']]));
    form.appendChild(chipset('test', 'Test result', [['any', 'Any'], ['salvific', 'Salvific'], ['worldly', 'Worldly'], ['ratio', 'Ratio'], ['logos', 'Logos'], ['boundary', 'Boundary sorted'], ['unsorted', 'Any test not yet sorted']]));
    var foot = el('div', 'filter-foot');
    var tl = el('label', 'toggle');
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = state.met; cb.id = 'f-met';
    cb.addEventListener('change', function () { state.met = cb.checked; apply(); });
    tl.appendChild(cb); tl.appendChild(document.createTextNode('Show “met along the way”'));
    foot.appendChild(tl);
    var reset = el('button', 'ghost-btn', 'Clear filters'); reset.type = 'button';
    reset.addEventListener('click', function () { resetFilters(); });
    foot.appendChild(reset);
    form.appendChild(foot);
    f.body.appendChild(form);
    return f.node;
  }
  function resetFilters() {
    state.kind = 'all'; state.status = 'all'; state.test = 'any'; state.met = true;
    root.querySelectorAll('.filters input[type=radio]').forEach(function (i) {
      i.checked = (i.value === state[i.name.slice(2)]);
    });
    var cb = document.getElementById('f-met'); if (cb) cb.checked = true;
    apply();
  }

  function matches(item) {
    if (item.kind === 'met' && !state.met) return false;
    if (state.kind !== 'all' && item.kind !== state.kind) return false;
    var st = item.status && item.status.value;
    if (state.status === 'none') { if (has(st)) return false; }
    else if (state.status !== 'all' && st !== state.status) return false;
    var t = item.tests || {};
    var sv = t.salvific && t.salvific.value, rv = t.reason && t.reason.value, bt = t.boundary && t.boundary.text;
    switch (state.test) {
      case 'salvific': return sv === 'salvific';
      case 'worldly': return sv === 'worldly';
      case 'ratio': return rv === 'ratio';
      case 'logos': return rv === 'logos';
      case 'boundary': return has(bt);
      case 'unsorted': return !has(sv) || !has(rv) || !has(bt);
    }
    return true;
  }

  function apply() {
    var shown = 0;
    cards.forEach(function (c) {
      var ok = matches(c.item);
      c.li.hidden = !ok;
      if (ok) shown++;
    });
    carries.forEach(function (c) { c.li.hidden = !matches(c.item); });
    eraSections.forEach(function (s) {
      var any = s.list.querySelector(':scope > li.entry:not([hidden])');
      s.empty.hidden = !!any;
      (data.tracks || []).forEach(function (t, i) {
        s.list.classList.toggle('hide-' + (i ? 'b' : 'a'), !matches(t));
      });
    });
    root.querySelectorAll('.group[data-group]').forEach(function (g) {
      var any = g.querySelector('li.entry:not([hidden])');
      g.hidden = !any;
    });
    var total = cards.length;
    if (countEl) countEl.textContent = 'Showing ' + shown + ' of ' + total + '.';
    var active = (state.kind !== 'all') + (state.status !== 'all') + (state.test !== 'any') + (!state.met);
    if (filterHint) filterHint.textContent = active ? active + ' active' : '';
  }

  /* ---------- cards ---------- */
  function chip(text, cls, key) {
    var c = el('span', 'chip' + (cls ? ' ' + cls : ''));
    if (key) c.appendChild(el('span', 'k', key + ' '));
    c.appendChild(document.createTextNode(text));
    return c;
  }
  function testChips(item) {
    var box = el('div', 'chips');
    var missing = [];
    var st = item.status || {};
    if (has(st.value)) box.appendChild(chip(LABEL.status[st.value] || st.value, st.value === 'ongoing' ? 'ongoing' : ''));
    else missing.push('status');
    var t = item.tests || {};
    [['salvific', 'salvific or worldly'], ['reason', 'ratio or Logos']].forEach(function (p) {
      var v = t[p[0]] || {};
      if (has(v.value)) {
        var c = chip(LABEL[p[0]][v.value] || v.value, v.flag ? 'flagged' : '');
        if (v.flag) c.appendChild(el('span', 'k', ' · ' + shortFlag(v.flag)));
        box.appendChild(c);
      } else missing.push(p[1]);
    });
    if (t.boundary && has(t.boundary.text)) box.appendChild(chip('sorted', t.boundary.flag ? 'flagged' : '', 'Boundary'));
    else missing.push('boundary');
    if (item.placementUncertain) box.appendChild(chip('placement uncertain', 'uncertain'));
    if (missing.length) box.appendChild(chip(missing.join(', '), 'ns', 'Not yet sorted:'));
    return box;
  }

  function sec(title, content) {
    var s = el('section', 'pc-sec');
    s.appendChild(el('h4', null, title));
    if (content) s.appendChild(content);
    return s;
  }
  function kvRow(k, valueNode, note, refs, flagText) {
    var row = el('div');
    row.appendChild(el('div', 'kv-k', k));
    var v = el('div', 'kv-v');
    v.appendChild(valueNode);
    if (flagText) v.appendChild(flag(flagText));
    if (has(note)) v.appendChild(el('span', 'kv-note', note));
    var r = refLinks(refs);
    if (r) { v.appendChild(document.createTextNode(' ')); v.appendChild(r); }
    row.appendChild(v);
    return row;
  }
  function list(items, map) {
    var ul = el('ul', 'plain-list');
    items.forEach(function (x) { ul.appendChild(map(x)); });
    return ul;
  }

  function fullView(item, fullId) {
    var full = el('div', 'pc-full');
    full.id = fullId;
    full.hidden = true;

    full.appendChild(sec('Overview', paras(item.overview)));

    var kindRow = el('div', 'kv');
    var kv = el('span', 'kv-val', LABEL.kind[item.kind] || item.kind);
    kindRow.appendChild(kvRow('Kind', kv, item.kindNote));
    kindRow.appendChild(kvRow('Period', has(item.period) ? el('span', null, item.period) : unsorted(), null, null, item.placementUncertain ? 'placement uncertain' : null));
    var span = X.fmtSpan(item);
    kindRow.appendChild(kvRow('Dates', span ? el('span', null, span) : unsorted()));
    var st = item.status || {};
    kindRow.appendChild(kvRow('Status', has(st.value) ? el('span', 'kv-val', LABEL.status[st.value] || st.value) : unsorted(), st.note));
    full.appendChild(sec('Status', kindRow));

    var t = item.tests || {};
    var tk = el('div', 'kv');
    var sv = t.salvific || {}, rv = t.reason || {}, bd = t.boundary || {};
    tk.appendChild(kvRow('Salvific or worldly', has(sv.value) ? el('span', 'kv-val', LABEL.salvific[sv.value] || sv.value) : unsorted(), sv.note, null, sv.flag));
    tk.appendChild(kvRow('Ratio or Logos', has(rv.value) ? el('span', 'kv-val', LABEL.reason[rv.value] || rv.value) : unsorted(), rv.note, null, rv.flag));
    tk.appendChild(kvRow('Boundary', has(bd.text) ? el('span', null, bd.text) : unsorted(), null, bd.refs, bd.flag));
    full.appendChild(sec('Tests', tk));

    var rel = el('div');
    if (item.items && item.items.length) {
      var ul = list(item.items, function (x) { return el('li', null, x); });
      ul.classList.add('items-list');
      rel.appendChild(ul);
    }
    if (item.relevant && item.relevant.length) {
      if (rel.childNodes.length) rel.appendChild(el('p', 'sub-h', 'Connected entries'));
      rel.appendChild(list(item.relevant, function (x) { return textWithRefs('li', null, x); }));
    }
    if (!rel.childNodes.length) rel.appendChild(unsorted());
    full.appendChild(sec('Relevant items', rel));

    var sh = item.shifts || {};
    var ins = (sh['in'] || []).slice(), outs = (sh.out || []).slice(), noted = [];
    (data.shiftsNoticed || []).forEach(function (s) {
      if ((s.to || []).indexOf(item.id) > -1) ins.push(s);
      else if ((s.from || []).indexOf(item.id) > -1) outs.push(s);
      else if ((s.refs || []).indexOf(item.id) > -1) noted.push(s);
    });
    var shBox = el('div');
    shBox.appendChild(el('p', 'sub-h', 'In'));
    shBox.appendChild(ins.length ? list(ins, function (x) { return textWithRefs('li', null, x); }) : unsorted());
    shBox.appendChild(el('p', 'sub-h', 'Out'));
    shBox.appendChild(outs.length ? list(outs, function (x) { return textWithRefs('li', null, x); }) : unsorted());
    if (noted.length) {
      shBox.appendChild(el('p', 'sub-h', 'Also noticed'));
      shBox.appendChild(list(noted, function (x) { return textWithRefs('li', null, x); }));
    }
    full.appendChild(sec('Shifts', shBox));

    full.appendChild(sec('Living definition', has(item.livingDefinition) ? paras(item.livingDefinition) : unsorted()));

    var oq = item.openQuestions || [];
    full.appendChild(sec('Open questions', oq.length ? list(oq, function (x) { return el('li', null, x); }) : unsorted()));

    var actions = el('div', 'pc-actions');
    var close = el('button', 'ghost-btn', 'Close');
    close.type = 'button';
    actions.appendChild(close);
    actions.appendChild(actionBtn('Copy entry', function () { return X.itemMd(data, item, 2); }));
    actions.appendChild(actionBtn('Copy interview prompt', function () { return X.interviewPrompt(data, [item], { dataPath: dataPath }); }));
    full.appendChild(actions);
    return { node: full, close: close };
  }

  function card(item) {
    var art = el('article', 'pc' + (item.kind === 'met' ? ' met' : ''));
    art.id = item.slug;
    var sum = el('div', 'pc-sum');
    var top = el('div', 'pc-top');
    top.appendChild(el('span', 'pc-num', numLabel(item)));
    top.appendChild(el('span', 'pc-kind', LABEL.kind[item.kind] || item.kind));
    var caret = el('span', 'pc-caret', '+');
    caret.setAttribute('aria-hidden', 'true');
    top.appendChild(caret);
    sum.appendChild(top);
    var h = el('h3', 'pc-title');
    var btn = el('button', 'pc-toggle', item.title);
    btn.type = 'button';
    btn.setAttribute('aria-expanded', 'false');
    var fullId = 'full-' + item.slug;
    btn.setAttribute('aria-controls', fullId);
    h.appendChild(btn);
    sum.appendChild(h);
    var per = el('p', 'pc-period');
    if (has(item.period)) per.textContent = item.period; else { per.appendChild(document.createTextNode('Period ')); per.appendChild(unsorted()); }
    sum.appendChild(per);
    var span = X.fmtSpan(item);
    if (span) sum.appendChild(el('p', 'pc-dates mono', span));
    sum.appendChild(testChips(item));
    art.appendChild(sum);
    var fv = fullView(item, fullId);
    art.appendChild(fv.node);

    var c = { item: item, article: art, button: btn, full: fv.node, caret: caret };
    btn.addEventListener('click', function () { setOpen(c, btn.getAttribute('aria-expanded') !== 'true', true); });
    fv.close.addEventListener('click', function () { setOpen(c, false, true); btn.focus(); });
    return c;
  }

  function setOpen(c, open, updateHash) {
    c.button.setAttribute('aria-expanded', open ? 'true' : 'false');
    c.full.hidden = !open;
    c.article.classList.toggle('open', open);
    c.caret.textContent = open ? '−' : '+';
    if (updateHash && window.history && history.replaceState) {
      if (open) history.replaceState(null, '', '#' + c.item.slug);
      else if (location.hash === '#' + c.item.slug) history.replaceState(null, '', location.pathname + location.search);
    }
  }

  function entryLi(c, extraTop) {
    var li = el('li', 'entry');
    li.appendChild(el('span', 'node' + (c.item.status && c.item.status.value === 'ongoing' ? ' ongoing' : '')));
    var cell = el('div');
    cell.style.minWidth = '0';
    cell.style.gridColumn = '-2';
    if (extraTop) extraTop.forEach(function (n) { cell.appendChild(n); });
    cell.appendChild(c.article);
    li.appendChild(cell);
    c.li = li;
    return li;
  }

  function addRails(li, flags) {
    var r = el('span', 'rails');
    r.setAttribute('aria-hidden', 'true');
    flags.forEach(function (f, i) {
      if (!f.on) return;
      r.appendChild(el('span', 'rail ' + (i ? 'b' : 'a') + (f.start ? ' start' : '') + (f.unplaced ? ' unplaced' : '')));
    });
    li.insertBefore(r, li.children[1]);
  }

  /* ---------- eras ---------- */
  function renderEras() {
    var frag = document.createDocumentFragment();
    var eras = data.eras || [];
    var tracks = data.tracks || [];
    eras.forEach(function (era, ei) {
      var s = el('section', 'era');
      s.setAttribute('aria-labelledby', 'era-' + era.key);
      var head = el('div', 'era-head');
      var h2 = el('h2', null, era.name); h2.id = 'era-' + era.key;
      head.appendChild(h2);
      var items = (data.paradigms || []).filter(function (p) { return p.era === era.key; });
      head.appendChild(el('span', 'mono', String(items.length).padStart(2, '0')));
      s.appendChild(head);

      var withRails = tracks.some(function (t) { return t.era === era.key; });
      var ol = el('ol', 'tl' + (withRails ? ' with-rails' : ''));
      var rows = [];

      // Paradigms from earlier bands that are still running here.
      (data.paradigms || []).forEach(function (p) {
        if (p.era === era.key || (p.alsoIn || []).indexOf(era.key) < 0) return;
        var li = el('li', 'carry');
        li.appendChild(el('span', 'node carry'));
        var row = el('div', 'carry-row');
        row.appendChild(el('span', 'mono', 'Still running'));
        var a = el('a', null, numLabel(p) + ' ' + p.title);
        a.href = '#' + p.slug;
        row.appendChild(a);
        if (p.status && has(p.status.value)) row.appendChild(document.createTextNode(' · ' + (LABEL.status[p.status.value] || p.status.value).toLowerCase()));
        li.appendChild(row);
        carries.push({ item: p, li: li });
        rows.push({ li: li, id: null });
      });

      items.forEach(function (p) {
        var c = card(p);
        cards.push(c);
        bySlug[p.slug] = c;
        var marks = [];
        tracks.forEach(function (t, ti) {
          if (t.era === era.key && t.track && t.track.startsAt === p.id) {
            var m = el('div', 'track-mark ' + (ti ? 'b' : 'a'));
            m.appendChild(el('span', 'mono', t.track.label));
            var a = el('a', null, t.title);
            a.href = '#' + t.slug;
            m.appendChild(a);
            if (t.track.startNote) m.appendChild(document.createTextNode(' · ' + t.track.startNote));
            marks.push(m);
          }
        });
        rows.push({ li: entryLi(c, marks), id: p.id });
      });

      if (withRails) {
        var started = tracks.map(function () { return false; });
        rows.forEach(function (r, ri) {
          var flags = tracks.map(function (t, ti) {
            if (t.era !== era.key) return { on: false };
            var sa = t.track && t.track.startsAt;
            var start = false, unplaced = false;
            if (!started[ti]) {
              if (!sa && ri === 0) { started[ti] = true; start = true; unplaced = true; }
              else if (sa && r.id === sa) { started[ti] = true; start = true; }
            }
            return { on: started[ti], start: start, unplaced: unplaced };
          });
          addRails(r.li, flags);
        });
      }

      rows.forEach(function (r) { ol.appendChild(r.li); });
      s.appendChild(ol);
      var empty = el('p', 'era-empty', 'Nothing in this band matches the filters.');
      empty.hidden = true;
      s.appendChild(empty);
      eraSections.push({ list: ol, empty: empty });
      frag.appendChild(s);
    });
    return frag;
  }

  function renderGroup(key, title, desc, items, quiet) {
    if (!items || !items.length) return null;
    var g = el('section', 'group' + (quiet ? ' quiet' : ''));
    g.setAttribute('data-group', key);
    g.setAttribute('aria-labelledby', 'g-' + key);
    var head = el('div', 'group-head');
    var h = el('h2', null, title); h.id = 'g-' + key;
    head.appendChild(h);
    if (desc) head.appendChild(el('p', null, desc));
    g.appendChild(head);
    var ol = el('ol', 'tl');
    items.forEach(function (p) {
      var c = card(p);
      cards.push(c);
      bySlug[p.slug] = c;
      ol.appendChild(entryLi(c));
    });
    g.appendChild(ol);
    return g;
  }

  function renderNotes(key, title, list) {
    var g = el('section', 'group');
    g.setAttribute('aria-labelledby', 'n-' + key);
    var head = el('div', 'group-head');
    var h = el('h2', null, title); h.id = 'n-' + key;
    head.appendChild(h);
    g.appendChild(head);
    if (!list || !list.length) { g.appendChild(unsorted()); return g; }
    var ol = el('ol', 'note-list');
    list.forEach(function (x) { ol.appendChild(textWithRefs('li', null, x)); });
    g.appendChild(ol);
    return g;
  }

  function renderLog(key, title, items, map) {
    if (!items || !items.length) return null;
    var g = el('section', 'group');
    g.setAttribute('aria-labelledby', 'l-' + key);
    var head = el('div', 'group-head');
    var h = el('h2', null, title); h.id = 'l-' + key;
    head.appendChild(h);
    g.appendChild(head);
    var ol = el('ol', 'plain-list log-list');
    items.forEach(function (x) { ol.appendChild(map(x)); });
    g.appendChild(ol);
    return g;
  }

  /* ---------- print: expand everything, then restore ---------- */
  var printState = null;
  window.addEventListener('beforeprint', function () {
    printState = { view: currentView, open: cards.filter(function (c) { return !c.full.hidden; }) };
    if (currentView !== 'entries') showView('entries', false);
    cards.forEach(function (c) { setOpen(c, true, false); });
  });
  window.addEventListener('afterprint', function () {
    if (!printState) return;
    cards.forEach(function (c) { setOpen(c, printState.open.indexOf(c) > -1, false); });
    if (printState.view !== 'entries') showView(printState.view, false);
    printState = null;
  });

  /* ---------- routing (slug anchors) ---------- */
  function openFromHash(scroll) {
    var slug = decodeURIComponent((location.hash || '').slice(1));
    if (!slug) return;
    var vm = slug.match(/^view=(\w+)$/);
    if (vm) { showView(vm[1], false); return; }
    var c = bySlug[slug];
    if (!c) return;
    if (currentView !== 'entries') showView('entries', false);
    if (c.li.hidden) resetFilters();
    setOpen(c, true, false);
    if (scroll) {
      c.button.focus({ preventScroll: true });
      c.article.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  root.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || !root.contains(a)) return;
    var slug = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!bySlug[slug]) return;
    e.preventDefault();
    if (location.hash !== '#' + slug) history.pushState(null, '', '#' + slug);
    openFromHash(true);
  });
  window.addEventListener('popstate', function () { openFromHash(true); });
  window.addEventListener('hashchange', function () { openFromHash(true); });

  /* ---------- boot ---------- */
  fetch(root.getAttribute('data-src'), { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      data = d;
      (d.paradigms || []).concat(d.tracks || [], d.met || []).forEach(function (p) { byId[p.id] = p; });
      root.innerHTML = '';
      root.appendChild(renderHead());
      root.appendChild(renderToolbar());
      root.appendChild(renderViewSwitch());
      var entries = el('div', 'nw-view-panel');
      views.entries = entries;
      views.chart = el('div', 'nw-view-panel');
      views.gaps = el('div', 'nw-view-panel');
      views.chart.hidden = true;
      views.gaps.hidden = true;
      var mount = root;
      root = entries;
      var folds = el('div');
      [renderDefinition(), renderLegend(), renderFilters()].forEach(function (n) { if (n) folds.appendChild(n); });
      root.appendChild(folds);
      countEl = el('p', 'result-count');
      countEl.setAttribute('role', 'status');
      countEl.setAttribute('aria-live', 'polite');
      root.appendChild(countEl);
      root.appendChild(renderEras());
      [renderGroup('tracks', 'Running tracks', 'These run alongside the timeline rather than sitting at one point on it.', d.tracks),
       renderGroup('met', 'Met along the way', 'Other people’s paradigms I stood next to.', d.met, true),
       renderNotes('shifts', 'Shifts noticed', d.shiftsNoticed),
       renderNotes('open', 'Open', d.openItems)].forEach(function (n) { if (n) root.appendChild(n); });
      [renderLog('interviews', 'Interviews', d.interviews, function (x) {
         var li = el('li'); li.appendChild(document.createTextNode(X.isoDate(x.date) + ': ' + (x.summary || '')));
         var r = refLinks(x.entries); if (r) { li.appendChild(document.createTextNode(' ')); li.appendChild(r); }
         return li; }),
       renderLog('revisions', 'Revision history', d.revisions, function (x) {
         var li = el('li'); li.appendChild(document.createTextNode(X.isoDate(x.date) + ': '));
         li.appendChild(has(x.note) ? document.createTextNode(x.note) : unsorted()); return li; })
      ].forEach(function (n) { if (n) root.appendChild(n); });
      root = mount;
      root.appendChild(entries);
      root.appendChild(views.chart);
      root.appendChild(views.gaps);
      var foot = el('p', 'nw-foot');
      foot.textContent = 'A still image of current understanding, last revised ' + (fmtDate(d.lastRevised) || NS) + '.';
      root.appendChild(foot);
      apply();
      openFromHash(true);
    })
    .catch(function () {
      root.innerHTML = '';
      root.appendChild(el('p', 'load-err', 'This work couldn’t be loaded right now.'));
    });
})();
