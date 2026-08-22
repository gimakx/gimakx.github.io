/* Gimakx WhatsApp source tagging.
   Every WhatsApp CTA leaves carrying the name of the channel the visitor
   arrived from — ChatGPT, Google, Facebook, Website — so an inbound quote
   request says where it came from instead of being guessed at afterwards.

   First-touch, not last-touch. The referrer is captured the first time someone
   lands on the site and reused from then on. By the time a buyer has read two
   product pages and clicked WhatsApp, document.referrer is just gimakx.com,
   which tells us nothing about how they found us. B2B buyers also research
   across several days, so the first touch is kept for 30 days rather than for
   one session.

   Written entirely in JS string literals on purpose: browser auto-translate
   rewrites DOM text but never touches JS literals, so the tag survives a
   visitor reading the site translated into their own language. */
(function () {
'use strict';

var STORE_KEY = 'gimakx_source';
var TTL_DAYS  = 30;
var FALLBACK  = 'Website';   // no referrer: typed, bookmarked, or stripped
var OPENER    = 'Hi Gimakx, I’d like to request a quote.';
var MARK      = '— Source: ';

/* ---------- referrer host -> channel name ----------

   Ordered; first match wins. gemini.google.com has to be tested before the
   generic google.* entry or it would come through as "Google". Hosts arrive
   here already lowercased and stripped of a leading "www.". */

var CHANNELS = [
  [/^chatgpt\.com$/,                 'ChatGPT'],
  [/^chat\.openai\.com$/,            'ChatGPT'],
  [/^openai\.com$/,                  'ChatGPT'],
  [/^perplexity\.ai$/,               'Perplexity'],
  [/^gemini\.google\.com$/,          'Gemini'],
  [/^claude\.ai$/,                   'Claude'],
  [/^copilot\.microsoft\.com$/,      'Copilot'],
  [/^(.+\.)?bing\.com$/,             'Bing'],
  [/^google\.[a-z.]+$/,              'Google'],
  [/^duckduckgo\.com$/,              'DuckDuckGo'],
  [/^(search\.)?yahoo\.com$/,        'Yahoo'],
  [/^yandex\.[a-z.]+$/,              'Yandex'],
  [/^(l\.|m\.|lm\.|web\.)?facebook\.com$/, 'Facebook'],
  [/^fb\.(com|me)$/,                 'Facebook'],
  [/^(l\.)?instagram\.com$/,         'Instagram'],
  [/^linkedin\.com$/,                'LinkedIn'],
  [/^lnkd\.in$/,                     'LinkedIn'],
  [/^(x|twitter)\.com$/,             'X'],
  [/^t\.co$/,                        'X'],
  [/^(m\.)?youtube\.com$/,           'YouTube'],
  [/^youtu\.be$/,                    'YouTube'],
  [/^tiktok\.com$/,                  'TikTok'],
  [/^pinterest\.[a-z.]+$/,           'Pinterest'],
  [/^reddit\.com$/,                  'Reddit'],
  [/^t\.me$/,                        'Telegram'],
  [/^(web\.)?whatsapp\.com$/,        'WhatsApp'],
  [/^alibaba\.com$/,                 'Alibaba'],
  [/^made-in-china\.com$/,           'Made-in-China']
];

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch (e) { return ''; }
}

/* '' when there is nothing useful to report — no referrer, or the visitor just
   moved between our own pages. The caller decides what to do with that. */
function channelOf(url) {
  var host = hostOf(url);
  if (!host) return '';
  if (host === hostOf(location.href)) return '';
  for (var i = 0; i < CHANNELS.length; i++) {
    if (CHANNELS[i][0].test(host)) return CHANNELS[i][1];
  }
  return host;   // unknown referrer: the bare domain is the honest answer
}

/* A campaign tag beats a sniffed referrer, so ?utm_source=newsletter wins. */
function campaignOf(search) {
  try {
    var v = new URLSearchParams(search).get('utm_source');
    if (!v) return '';
    v = v.trim();
    return v ? v.charAt(0).toUpperCase() + v.slice(1) : '';
  } catch (e) { return ''; }
}

/* ---------- the stored first touch ---------- */

function read() {
  try {
    var rec = JSON.parse(localStorage.getItem(STORE_KEY));
    if (!rec || !rec.source || !rec.at) return null;
    var age = Date.now() - Date.parse(rec.at);
    if (!(age >= 0) || age > TTL_DAYS * 864e5) return null;
    return rec;
  } catch (e) { return null; }
}

function write(rec) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); }
  catch (e) { /* private mode — the tag still works for this page view */ }
}

/* The first touch wins and is never overwritten while it is still fresh, with
   one exception: a visitor first seen as "Website" who later arrives from a
   real channel is upgraded, since the blank was the less informative guess.

   Counted once per page view: every later caller on this page gets the record
   already built, or the view count would climb with each click instead. */
var current = null;

function capture() {
  if (current) return current;

  var found = campaignOf(location.search) || channelOf(document.referrer);
  var rec   = read();

  if (rec) {
    if (found && rec.source === FALLBACK) {
      rec.source = found;
      rec.referrer = document.referrer || '';
    }
    rec.views = (rec.views || 0) + 1;
    write(rec);
    current = rec;
    return rec;
  }

  rec = {
    source:   found || FALLBACK,
    referrer: document.referrer || '',
    landing:  location.pathname + location.search,
    at:       new Date().toISOString(),
    views:    1
  };
  write(rec);
  current = rec;
  return rec;
}

/* Clarity is the one place this detail is readable from your side rather than
   the visitor's, so mirror it there when the tag is running. It only loads
   after cookie consent, so this is a bonus rather than the mechanism. */
function mirrorToClarity(rec) {
  if (typeof window.clarity !== 'function') return;
  try {
    window.clarity('set', 'leadSource', rec.source);
    window.clarity('set', 'leadLanding', rec.landing || '/');
  } catch (e) { /* older tag without custom tags */ }
}

/* ---------- link tagging ---------- */

/* wa.me carries the whole message in ?text=, so tagging a link means editing
   that parameter. Bare links have no text at all and get an opening line, so
   the buyer lands in WhatsApp with something ready to send rather than a lone
   signature they would sensibly delete. */
function tagUrl(url, source) {
  var line = '\n\n' + MARK + source;
  var m = url.match(/([?&]text=)([^&#]*)/);

  if (m) {
    if (decodeURIComponent(m[2].replace(/\+/g, ' ')).indexOf(MARK) !== -1) return url;
    return url.replace(m[0], m[1] + m[2] + encodeURIComponent(line));
  }
  return url + (url.indexOf('?') === -1 ? '?' : '&') +
         'text=' + encodeURIComponent(OPENER + line);
}

function onActivate(e) {
  var a = e.target && e.target.closest ? e.target.closest('a[href*="wa.me"]') : null;
  if (!a) return;
  var rec = capture();
  mirrorToClarity(rec);
  a.href = tagUrl(a.href, rec.source);
}

/* ---------- boot ---------- */

var first = capture();
mirrorToClarity(first);

/* Capture phase, so the href is rewritten before the browser follows it.
   auxclick covers the middle-click-to-new-tab case. */
document.addEventListener('click', onActivate, true);
document.addEventListener('auxclick', onActivate, true);

/* The RFQ forms build their own message and hand it straight to window.open,
   so they read the source from here instead of going through a link. */
window.gimakxSource = function () {
  var rec = capture();
  mirrorToClarity(rec);
  return rec.source;
};

})();
