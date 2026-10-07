/*
  Slider manual: scroll horizontal nativo con scroll-snap. Sin autoplay; se
  mueve con el dedo (swipe nativo del navegador) o con las flechas.

  Markup:
    <div data-snap-slider [data-snap-loop] [data-snap-focus]>
      <button data-snap-prev>  <div data-snap-track> ...tarjetas... </div>  <button data-snap-next>
    </div>

  data-snap-loop: el track trae las tarjetas repetidas 3 veces. Arranca en la
  copia del medio y, cuando el scroll se detiene cerca de un extremo, salta en
  silencio una copia completa. Como las copias son identicas, el salto no se ve
  y la tira parece infinita.

  data-snap-focus: marca con .is-center la tarjeta mas cercana al centro.
*/
(function () {
  function init(root) {
    if (root.dataset.snapReady) return;
    var track = root.querySelector('[data-snap-track]');
    if (!track) return;
    root.dataset.snapReady = '1';

    var loop = root.hasAttribute('data-snap-loop');
    var focus = root.hasAttribute('data-snap-focus');
    var prev = root.querySelector('[data-snap-prev]');
    var next = root.querySelector('[data-snap-next]');

    function cards() { return track.children; }

    function step() {
      var c = cards();
      if (c.length < 2) return track.clientWidth;
      return c[1].offsetLeft - c[0].offsetLeft;
    }

    function setWidth() {
      var c = cards();
      var n = c.length / 3;
      if (!loop || n < 1 || n !== Math.floor(n)) return 0;
      return c[n].offsetLeft - c[0].offsetLeft;
    }

    // No se apaga el snap para saltar: al volver a prenderlo, Chrome re-centra
    // sobre la tarjeta que tenia antes (que esta en otra copia) y la tira se
    // quedaba a medias entre dos tarjetas. El salto es de una copia exacta, asi
    // que cae justo en otra posicion de snap equivalente.
    function jump(left) {
      track.style.scrollBehavior = 'auto';
      track.scrollLeft = left;
      track.style.scrollBehavior = '';
    }

    function centerOn(card) {
      return card.offsetLeft + card.offsetWidth / 2 - track.clientWidth / 2;
    }

    function rebase() {
      var w = setWidth();
      if (!w) return;
      if (track.scrollLeft < w * 0.5) jump(track.scrollLeft + w);
      else if (track.scrollLeft > w * 1.5) jump(track.scrollLeft - w);
    }

    function markCenter() {
      if (!focus) return;
      var mid = track.scrollLeft + track.clientWidth / 2;
      var best = null, bestDist = Infinity;
      Array.prototype.forEach.call(cards(), function (card) {
        var d = Math.abs(card.offsetLeft + card.offsetWidth / 2 - mid);
        if (d < bestDist) { bestDist = d; best = card; }
      });
      Array.prototype.forEach.call(cards(), function (card) {
        card.classList.toggle('is-center', card === best);
      });
    }

    function go(dir) {
      var max = track.scrollWidth - track.clientWidth;
      if (!loop && dir > 0 && track.scrollLeft >= max - 4) {
        track.scrollTo({ left: 0, behavior: 'smooth' });
      } else if (!loop && dir < 0 && track.scrollLeft <= 4) {
        track.scrollTo({ left: max, behavior: 'smooth' });
      } else {
        track.scrollBy({ left: dir * step(), behavior: 'smooth' });
      }
    }

    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });

    // El salto del loop se hace solo cuando el scroll termino de verdad (dedo
    // levantado y snap asentado). `scrollend` da eso exacto; donde no existe,
    // se espera a que el scroll quede quieto un rato.
    var hasScrollEnd = 'onscrollend' in window;
    var fingerDown = false;
    track.addEventListener('touchstart', function () { fingerDown = true; }, { passive: true });
    track.addEventListener('touchend', function () { fingerDown = false; }, { passive: true });
    track.addEventListener('touchcancel', function () { fingerDown = false; }, { passive: true });

    var ticking = false, idle = null;
    function settle() {
      if (fingerDown) { idle = setTimeout(settle, 200); return; }
      rebase();
      markCenter();
    }
    track.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(function () { ticking = false; markCenter(); });
      }
      if (loop && !hasScrollEnd) {
        clearTimeout(idle);
        idle = setTimeout(settle, 400);
      }
    }, { passive: true });
    if (loop && hasScrollEnd) track.addEventListener('scrollend', settle);

    // Si la persona ya movio el slider antes de que termine de cargar la
    // pagina, `load` no la regresa a la posicion inicial.
    var touched = false;
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      track.addEventListener(ev, function () { touched = true; }, { passive: true });
    });
    [prev, next].forEach(function (btn) {
      if (btn) btn.addEventListener('click', function () { touched = true; });
    });

    function place() {
      if (touched) return;
      var c = cards();
      if (loop && c.length >= 3) {
        var first = c[c.length / 3];
        jump(focus ? centerOn(first) : first.offsetLeft);
      }
      markCenter();
    }

    place();
    // Las imagenes y las fuentes cambian el ancho de las tarjetas al cargar.
    window.addEventListener('load', place);
    window.addEventListener('resize', function () { rebase(); markCenter(); });
  }

  function initAll(scope) {
    (scope || document).querySelectorAll('[data-snap-slider]').forEach(init);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initAll(); });
  } else {
    initAll();
  }
  document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });

  // `shopify theme dev` recarga secciones en caliente sin disparar el evento de
  // arriba ni re-ejecutar este script; sin esto el slider nuevo quedaba sin
  // inicializar (pegado al inicio, sin tarjeta centrada).
  if (window.MutationObserver) {
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].addedNodes.length) { initAll(); return; }
      }
    }).observe(document.documentElement, { childList: true, subtree: true });
  }
})();
