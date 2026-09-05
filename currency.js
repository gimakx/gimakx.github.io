/* Currency selector — USD / GBP / EUR.
 *
 * Prices are authored in USD in the HTML and carry data-usd, so the USD figures
 * survive with JavaScript off and the JSON-LD (which stays USD) always matches
 * what a crawler reads on first paint.
 *
 * Rates are baked in so the switcher works instantly and offline, then quietly
 * refreshed from a free API at most once a day. A failed refresh is a no-op —
 * the baked rates keep working rather than the page showing nothing.
 *
 * USD remains the contract currency; GBP/EUR are indicative only, which the
 * note under each price table says out loud.
 */
(function () {
  'use strict';

  var FALLBACK = { USD: 1, GBP: 0.7398, EUR: 0.8606 };
  var FALLBACK_DATE = '2026-09-04';
  var SYMBOL = { USD: '$', GBP: '£', EUR: '€' };
  var STORE_CUR = 'gimakx.currency';
  var STORE_FX = 'gimakx.fx';
  var MAX_AGE = 24 * 60 * 60 * 1000;
  var ENDPOINT = 'https://open.er-api.com/v6/latest/USD';

  var rates = FALLBACK, asOf = FALLBACK_DATE, current = 'USD';

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, val) {
    try { window.localStorage.setItem(key, val); } catch (e) { /* private mode */ }
  }

  function format(usd, cur) {
    var v = usd * (rates[cur] || 1);
    // Whole units read better on a price list; keep cents where rounding would
    // distort a low-value line (a $2 belt must not become £1).
    var s = v >= 10 ? String(Math.round(v)) : v.toFixed(2);
    return SYMBOL[cur] + s;
  }

  function apply(cur) {
    current = cur;
    var els = document.querySelectorAll('[data-usd]');
    for (var i = 0; i < els.length; i++) {
      var usd = parseFloat(els[i].getAttribute('data-usd'));
      if (!isNaN(usd)) els[i].textContent = format(usd, cur);
    }
    var notes = document.querySelectorAll('[data-fx-note]');
    for (var j = 0; j < notes.length; j++) {
      notes[j].textContent = cur === 'USD'
        ? ''
        : 'Showing ' + cur + ' at 1 USD = ' + (rates[cur] || 1).toFixed(4) + ' ' +
          cur + ' (' + asOf + '). Conversions are indicative — orders are ' +
          'quoted and invoiced in USD.';
    }
    var sels = document.querySelectorAll('.cur-select');
    for (var k = 0; k < sels.length; k++) sels[k].value = cur;
    document.documentElement.setAttribute('data-currency', cur);
  }

  function useRates(r, date) {
    if (!r || typeof r.GBP !== 'number' || typeof r.EUR !== 'number') return;
    rates = { USD: 1, GBP: r.GBP, EUR: r.EUR };
    if (date) asOf = date;
    apply(current);
  }

  function refresh() {
    var cached = read(STORE_FX);
    if (cached) {
      try {
        var c = JSON.parse(cached);
        if (c && c.rates && (Date.now() - c.at) < MAX_AGE) {
          useRates(c.rates, c.date);
          return;                       // fresh enough, no network call
        }
        useRates(c.rates, c.date);      // stale but better than nothing
      } catch (e) { /* corrupt cache, ignore */ }
    }
    if (!window.fetch) return;
    fetch(ENDPOINT, { mode: 'cors' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || !d.rates || !d.rates.GBP || !d.rates.EUR) return;
        var r = { GBP: d.rates.GBP, EUR: d.rates.EUR };
        var date = (d.time_last_update_utc || '').slice(5, 16) || asOf;
        useRates(r, date);
        write(STORE_FX, JSON.stringify({ rates: r, date: date, at: Date.now() }));
      })
      .catch(function () { /* offline or blocked — baked rates stand */ });
  }

  function wire(sel) {
    if (sel.getAttribute('data-wired')) return;
    sel.setAttribute('data-wired', '1');
    sel.addEventListener('change', function () {
      write(STORE_CUR, this.value);
      apply(this.value);
    });
  }

  function build() {
    var hosts = document.querySelectorAll('.nav-right');
    for (var i = 0; i < hosts.length; i++) {
      // The selector ships in the HTML so the nav does not shift on load;
      // if it is already there, just wire it up rather than skipping it.
      var existing = hosts[i].querySelector('.cur-select');
      if (existing) { wire(existing); continue; }
      var wrap = document.createElement('div');
      wrap.className = 'cur-wrap';
      var sel = document.createElement('select');
      sel.className = 'cur-select';
      sel.setAttribute('aria-label', 'Display currency');
      ['USD', 'GBP', 'EUR'].forEach(function (c) {
        var o = document.createElement('option');
        o.value = c;
        o.textContent = SYMBOL[c] + ' ' + c;
        sel.appendChild(o);
      });
      wire(sel);
      wrap.appendChild(sel);
      hosts[i].insertBefore(wrap, hosts[i].firstChild);
    }
  }

  function init() {
    build();
    var saved = read(STORE_CUR);
    apply(SYMBOL[saved] ? saved : 'USD');
    refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
