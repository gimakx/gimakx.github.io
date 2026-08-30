/* Gimakx product image zoom.

   Buyers evaluating a factory want to look at the stitching, and the gallery
   image is the biggest thing on the page — Clarity recorded dead clicks on it,
   people trying to enlarge a photo that did nothing. This makes every product
   shot open full-size.

   The displayed image is 800px, barely bigger than the frame it sits in, so
   zooming to it would show nothing new. Each one has a 1600px WebP twin that is
   fetched only when someone actually opens the viewer — no cost to page load.

   Progressive enhancement on purpose: the affordance (cursor, role, tabindex)
   is added by this script, so with JS off the images stay plain images rather
   than advertising an interaction that cannot happen. */
(function () {
'use strict';

var ZOOMABLE = '.gallery-main img, .variant-panel-media img, .pb-media img';

/* images/GPNBL-800.webp -> images/GPNBL-1600.webp. Anything already at 1600
   (monolith) is used as-is. If the twin is missing we fall back to whatever was
   on the page, so a new image without a variant degrades instead of breaking. */
function hiResOf(src) {
  if (/-1600\.webp$/.test(src)) return src;
  if (/-800\.webp$/.test(src)) return src.replace(/-800\.webp$/, '-1600.webp');
  return src;
}

var overlay = null, dialog = null, img = null, cap = null, closeBtn = null, spinner = null;
var lastFocus = null;

function build() {
  overlay = document.createElement('div');
  overlay.className = 'zoom-overlay';
  overlay.innerHTML =
    '<div class="zoom-dialog" role="dialog" aria-modal="true" aria-label="Product image viewer">' +
      '<button type="button" class="zoom-close" aria-label="Close image viewer">' +
        '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">' +
        '<path d="M6 6l12 12M18 6L6 18"/></svg>' +
      '</button>' +
      '<div class="zoom-spinner" aria-hidden="true"></div>' +
      '<img class="zoom-img" alt="">' +
      '<p class="zoom-cap"></p>' +
    '</div>';

  dialog   = overlay.querySelector('.zoom-dialog');
  img      = overlay.querySelector('.zoom-img');
  cap      = overlay.querySelector('.zoom-cap');
  closeBtn = overlay.querySelector('.zoom-close');
  spinner  = overlay.querySelector('.zoom-spinner');

  closeBtn.addEventListener('click', close);
  // click the backdrop (but not the picture itself) to dismiss
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay || e.target === dialog) close();
  });

  document.body.appendChild(overlay);
}

/* Tab must not escape the viewer while it is open. There are only two stops —
   the close button and the image — so wrapping by hand is simpler than a
   general focus-trap. */
function onKeydown(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(); return; }
  if (e.key !== 'Tab') return;
  var stops = [closeBtn, img].filter(function (el) { return el.tabIndex >= 0; });
  if (!stops.length) return;
  var first = stops[0], last = stops[stops.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

function open(source) {
  if (!overlay) build();

  lastFocus = source;
  var shown = source.getAttribute('src');
  var hi = hiResOf(shown);

  cap.textContent = source.getAttribute('alt') || '';
  img.alt = source.getAttribute('alt') || '';
  img.tabIndex = 0;

  // show the 800px version immediately so there is never an empty frame,
  // then swap in the sharp one once it arrives
  img.src = shown;
  overlay.classList.add('is-loading');

  if (hi !== shown) {
    var hires = new Image();
    hires.onload  = function () { img.src = hi; overlay.classList.remove('is-loading'); };
    hires.onerror = function () { overlay.classList.remove('is-loading'); };
    hires.src = hi;
  } else {
    overlay.classList.remove('is-loading');
  }

  overlay.classList.add('is-open');
  document.documentElement.classList.add('zoom-locked');
  document.addEventListener('keydown', onKeydown, true);
  closeBtn.focus();
}

function close() {
  if (!overlay) return;
  overlay.classList.remove('is-open', 'is-loading');
  document.documentElement.classList.remove('zoom-locked');
  document.removeEventListener('keydown', onKeydown, true);
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  lastFocus = null;
}

/* Mark the images as interactive. Delegated activation below means the
   configurator can swap the gallery src freely without rebinding anything. */
function enhance() {
  var imgs = document.querySelectorAll(ZOOMABLE);
  for (var i = 0; i < imgs.length; i++) {
    var el = imgs[i];
    if (el.dataset.zoomReady) continue;
    el.dataset.zoomReady = '1';
    el.classList.add('is-zoomable');
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    var label = el.getAttribute('alt');
    el.setAttribute('aria-label', label ? ('View larger image: ' + label) : 'View larger image');
  }
}

document.addEventListener('click', function (e) {
  var t = e.target.closest ? e.target.closest(ZOOMABLE) : null;
  if (!t || !t.dataset.zoomReady) return;
  e.preventDefault();
  open(t);
});

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  var t = document.activeElement;
  if (!t || !t.dataset || !t.dataset.zoomReady) return;
  e.preventDefault();
  open(t);
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', enhance);
} else {
  enhance();
}

})();
