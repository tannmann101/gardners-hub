/* Notes Workspace: chart view for timeline works.
   1. "Across the eras": every entry as a bar over the era bands it is in
      (its own era plus `alsoIn`). Works with no dates at all.
   2. "Dated": entries with `dates` drawn on a real axis, by year, or by age
      when only ages are known. Grows as interviews add dates.
   Rows are links to the entry (#slug), so the page router opens them.
   Requires export.js (window.NotesExport). */
(function () {
  'use strict';
  var X = window.NotesExport;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function rowLabel(item) {
    var s = el('span', 'ch-label');
    s.appendChild(el('span', 'ch-num', X.numLabel(item)));
    s.appendChild(document.createTextNode(' ' + item.title));
    return s;
  }
  function isOngoing(item) {
    var v = item.status && item.status.value;
    return v === 'ongoing' || v === 'ongoing-not-held' || /ongoing/i.test(item.period || '');
  }

  /* ---------- 1. across the eras ---------- */
  function eraOverview(d) {
    var eras = d.eras || [];
    var wrap = el('section', 'ch-sec');
    wrap.setAttribute('aria-labelledby', 'ch-eras');
    var h = el('h2', 'ch-h', 'Across the eras'); h.id = 'ch-eras';
    wrap.appendChild(h);
    wrap.appendChild(el('p', 'ch-note', 'Each entry over the bands it belongs to. A bar continuing into a later band means the entry says it carried on there. An arrow means ongoing.'));

    var table = el('div', 'ch-eras');
    table.style.setProperty('--cols', eras.length);
    var head = el('div', 'ch-erow ch-ehead');
    head.setAttribute('aria-hidden', 'true');
    head.appendChild(el('span', 'ch-label'));
    eras.forEach(function (e) { head.appendChild(el('span', 'ch-ecol mono', e.name)); });
    table.appendChild(head);

    (d.paradigms || []).concat(d.tracks || []).forEach(function (item) {
      var a = el('a', 'ch-erow');
      a.href = '#' + item.slug;
      a.appendChild(rowLabel(item));
      var inEras = eras.map(function (e) { return item.era === e.key || (item.alsoIn || []).indexOf(e.key) > -1; });
      var last = inEras.lastIndexOf(true);
      var desc = [];
      eras.forEach(function (e, i) {
        var c = el('span', 'ch-cell');
        if (inEras[i]) {
          c.classList.add(item.era === e.key ? 'home' : 'carry');
          if (item.track) c.classList.add('track');
          if (i === last && isOngoing(item)) c.classList.add('ongoing');
          desc.push(e.name);
        }
        a.appendChild(c);
      });
      a.setAttribute('aria-label', X.numLabel(item) + ' ' + item.title + ': ' + (desc.join(', ') || X.NS) + (isOngoing(item) ? ', ongoing' : ''));
      table.appendChild(a);
    });
    wrap.appendChild(table);
    if ((d.met || []).length) wrap.appendChild(el('p', 'ch-note', '“Met along the way” entries aren’t placed in the eras.'));
    return wrap;
  }

  /* ---------- 2. dated ---------- */
  function nowYear(d) {
    var m = String(d.lastRevised || '').match(/^(\d{4})-(\d{2})/);
    return m ? parseInt(m[1], 10) + (parseInt(m[2], 10) - 1) / 12 : null;
  }
  function pv(pt, unit, by, upper) {
    if (!X.hasPoint(pt)) return null;
    var age = pt.age;
    if (upper && pt.ageTo) age = pt.ageTo;
    if (unit === 'year') {
      if (pt.year) return pt.year + ((pt.month || 1) - 1) / 12;
      if (age !== undefined && age !== null && by) return by + age;
      return null;
    }
    if (age !== undefined && age !== null) return age;
    if (pt.year && by) return pt.year - by;
    return null;
  }
  function niceStep(span) {
    var steps = [1, 2, 5, 10, 20, 25, 50];
    for (var i = 0; i < steps.length; i++) if (span / steps[i] <= 6) return steps[i];
    return 100;
  }

  function dated(d) {
    var wrap = el('section', 'ch-sec');
    wrap.setAttribute('aria-labelledby', 'ch-dated');
    var h = el('h2', 'ch-h', 'Dated'); h.id = 'ch-dated';
    wrap.appendChild(h);

    var by = d.birthYear || null;
    var items = X.allItems(d);
    var withDates = items.filter(function (p) { var x = p.dates || {}; return X.hasPoint(x.start) || X.hasPoint(x.end); });
    var anyYear = withDates.some(function (p) { var x = p.dates || {}; return (x.start && x.start.year) || (x.end && x.end.year); });
    var unit = anyYear ? 'year' : 'age';
    var now = unit === 'year' ? nowYear(d) : (by && nowYear(d) ? nowYear(d) - by : null);

    var rows = [], other = [];
    withDates.forEach(function (p) {
      var x = p.dates || {};
      var s = pv(x.start, unit, by), sTo = pv(x.start, unit, by, true);
      var e = pv(x.end, unit, by, true);
      var openEnd = false;
      if (e === null && isOngoing(p) && now !== null) e = now;
      else if (e === null) openEnd = true;
      if (s === null && e === null) { other.push(p); return; }
      rows.push({ p: p, s: s, sTo: sTo, e: e, openEnd: openEnd, approx: !!((x.start && x.start.approx) || (x.end && x.end.approx)) });
    });

    if (!rows.length) {
      wrap.appendChild(el('p', 'ch-note', 'Nothing has a date on it yet. Dates go in as interviews fill them in.'));
    } else {
      var lo = Infinity, hi = -Infinity;
      rows.forEach(function (r) { [r.s, r.sTo, r.e].forEach(function (v) { if (v !== null) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
      if (now !== null) hi = Math.max(hi, now);
      if (hi - lo < 4) { lo -= 2; hi += 2; }
      var step = niceStep(hi - lo);
      lo = Math.floor(lo / step) * step;
      hi = Math.ceil(hi / step) * step;
      var pct = function (v) { return ((v - lo) / (hi - lo)) * 100; };

      wrap.appendChild(el('p', 'ch-note', unit === 'year'
        ? 'By year.' + (by ? '' : ' Entries dated only by age need a birth year (birthYear in the data) to sit on this axis.')
        : 'By age, since nothing has a calendar year yet.' + (by ? '' : ' Adding birthYear to the data would let this switch to years.')));

      var chart = el('div', 'ch-dated');
      var axis = el('div', 'ch-axis');
      axis.setAttribute('aria-hidden', 'true');
      for (var v = lo; v <= hi; v += step) {
        var t = el('span', 'ch-tick', (unit === 'age' ? (v === lo ? 'age ' : '') : '') + v);
        t.style.left = pct(v) + '%';
        axis.appendChild(t);
      }
      chart.appendChild(axis);

      rows.forEach(function (r) {
        var a = el('a', 'ch-drow');
        a.href = '#' + r.p.slug;
        a.appendChild(rowLabel(r.p));
        var trackEl = el('span', 'ch-track');
        var start = r.s !== null ? r.s : lo;
        var end = r.e !== null ? r.e : (r.sTo !== null ? r.sTo : start);
        var bar = el('span', 'ch-bar' + (r.approx ? ' approx' : '') + (r.s === null ? ' open-start' : '') + (r.openEnd ? ' open-end' : ''));
        bar.style.left = pct(start) + '%';
        bar.style.width = Math.max(pct(end) - pct(start), 1.5) + '%';
        if (r.sTo !== null && r.s !== null && r.sTo > r.s) {
          bar.style.setProperty('--fuzz', ((r.sTo - r.s) / Math.max(end - start, 0.0001)) * 100 + '%');
          bar.classList.add('fuzzy-start');
        }
        trackEl.appendChild(bar);
        if (r.openEnd) {
          var tail = el('span', 'ch-tail');
          tail.style.left = pct(end) + '%';
          trackEl.appendChild(tail);
        }
        a.appendChild(trackEl);
        a.appendChild(el('span', 'ch-when', X.fmtSpan(r.p)));
        chart.appendChild(a);
      });
      wrap.appendChild(chart);
    }

    if (other.length) {
      var o = el('p', 'ch-note', 'Dated, but not placeable on this axis yet: ');
      other.forEach(function (p, i) {
        if (i) o.appendChild(document.createTextNode(', '));
        var a = el('a', 'ref', X.numLabel(p) + ' ' + p.title); a.href = '#' + p.slug;
        o.appendChild(a);
        o.appendChild(document.createTextNode(' (' + X.fmtSpan(p) + ')'));
      });
      wrap.appendChild(o);
    }

    var undated = items.filter(function (p) { return withDates.indexOf(p) < 0; });
    if (undated.length) {
      var u = el('div', 'ch-undated');
      u.appendChild(el('p', 'ch-note', 'Not yet dated (' + undated.length + '):'));
      var box = el('div', 'chips');
      undated.forEach(function (p) {
        var a = el('a', 'chip ns ch-chip', X.numLabel(p) + ' ' + p.title);
        a.href = '#' + p.slug;
        box.appendChild(a);
      });
      u.appendChild(box);
      wrap.appendChild(u);
    }
    return wrap;
  }

  window.NotesChart = {
    render: function (d, container) {
      container.innerHTML = '';
      container.appendChild(eraOverview(d));
      container.appendChild(dated(d));
    }
  };
})();
