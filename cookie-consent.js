/* Gimakx cookie consent.
   Microsoft Clarity is the only non-essential cookie user on this site, and it
   stays unloaded until the visitor accepts — no tag, no /collect calls, no
   _clck/_clsk. The choice is kept in localStorage, never in a cookie. */
(function () {
'use strict';

var STORE_KEY  = 'gimakx_cookie_consent';
var VERSION    = 1;              // bump to re-ask every visitor
var CLARITY_ID = 'y53qsu7wcc';

/* ---------- stored choice ---------- */

function readChoice() {
  try {
    var v = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!v || v.version !== VERSION) return null;
    return (v.choice === 'granted' || v.choice === 'denied') ? v.choice : null;
  } catch (e) { return null; }
}

function saveChoice(choice) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      choice: choice, version: VERSION, at: new Date().toISOString()
    }));
  } catch (e) { /* private mode — the choice holds for this page view only */ }
}

/* ---------- Microsoft Clarity ---------- */

function loadClarity() {
  if (typeof window.clarity !== 'function') {
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', CLARITY_ID);
  }
  signalClarity('granted');
}

/* Clarity runs in Consent Mode for EEA/UK/CH visitors — and for everyone if the
   project's "set cookies by default" switch is off — so it wants the signal as
   well as the tag. We never ask for advertising storage, so it stays denied. */
function signalClarity(analytics) {
  if (typeof window.clarity !== 'function') return;
  try {
    window.clarity('consentv2', { ad_Storage: 'denied', analytics_Storage: analytics });
  } catch (e) { /* older tag without consentv2 — the gate above already covers us */ }
}

function dropClarityCookies() {
  var host = location.hostname;
  var bare = host.replace(/^www\./, '');
  var domains = ['', host, '.' + host];
  if (bare !== host) domains.push(bare, '.' + bare);
  ['_clck', '_clsk'].forEach(function (name) {
    domains.forEach(function (d) {
      document.cookie = name + '=; max-age=0; path=/' + (d ? '; domain=' + d : '');
    });
  });
}

/* ---------- banner ---------- */

var banner = null;

function buildBanner() {
  var el = document.createElement('div');
  el.className = 'cc-banner';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-labelledby', 'cc-title');
  el.setAttribute('aria-describedby', 'cc-desc');
  el.setAttribute('tabindex', '-1');
  el.innerHTML =
    '<div class="cc-inner">' +
      '<div class="cc-text">' +
        '<h2 id="cc-title">Cookies on this site</h2>' +
        '<p id="cc-desc">We use Microsoft Clarity to understand how visitors use the site — which pages get read and where people get stuck. It sets two cookies and records anonymised session replays, with typed input masked. Nothing here is used for advertising, and we never sell your data. ' +
        '<a href="/privacy-policy.html#cookies">Read the details</a>.</p>' +
      '</div>' +
      '<div class="cc-actions">' +
        '<button type="button" class="cc-btn cc-decline">Decline</button>' +
        '<button type="button" class="cc-btn cc-accept">Accept</button>' +
      '</div>' +
    '</div>';

  el.querySelector('.cc-accept').addEventListener('click', function () {
    saveChoice('granted');
    loadClarity();
    hideBanner();
  });

  el.querySelector('.cc-decline').addEventListener('click', function () {
    var hadConsent = readChoice() === 'granted';
    saveChoice('denied');
    signalClarity('denied');
    dropClarityCookies();
    hideBanner();
    // Clarity was already recording this page view — reload so it stops for real.
    if (hadConsent) location.reload();
  });

  return el;
}

function showBanner() {
  if (!banner) { banner = buildBanner(); document.body.appendChild(banner); }
  banner.classList.add('is-open');
  banner.focus();
}

function hideBanner() {
  if (banner) banner.classList.remove('is-open');
}

/* ---------- wire-up ---------- */

// Global Privacy Control is a legally recognised opt-out — honour it and never ask.
function gpcOptOut() {
  return navigator.globalPrivacyControl === true;
}

// Footer "Cookie Settings" links reopen the banner instead of jumping to the policy.
document.addEventListener('click', function (e) {
  var link = e.target.closest ? e.target.closest('[data-cookie-settings]') : null;
  if (!link) return;
  e.preventDefault();
  showBanner();
});

window.gimakxCookieSettings = showBanner;

var choice = readChoice();
if (gpcOptOut()) {
  saveChoice('denied');
} else if (choice === 'granted') {
  loadClarity();
} else if (choice !== 'denied') {
  showBanner();
}

})();
