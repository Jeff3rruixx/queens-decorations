(function () {
  var WA = "573163131808";
  var WA_SHOW = "316 313 1808";
  var CATS = { decoracion: "Decoración de eventos", corporales: "Productos corporales", pijamas: "Pijamas" };

  var state = { items: [] };
  var loaded = false, failed = false;
  var filter = "todo";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function money(p) { var n = Number(String(p || "").replace(/[^\d]/g, "")); return n ? "$" + n.toLocaleString("es-CO") : ""; }
  function waLink(t) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(t); }

  var ICON_CROWN = '<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="M4 11l6 6 6-10 6 10 6-6-2.5 13h-19L4 11z" fill="#d6ae5c"/><rect x="6.5" y="25" width="19" height="2.6" rx="1" fill="#d6ae5c"/><circle cx="4" cy="10" r="1.8" fill="#d6ae5c"/><circle cx="16" cy="6" r="1.8" fill="#d6ae5c"/><circle cx="28" cy="10" r="1.8" fill="#d6ae5c"/></svg>';
  var ICON_WA = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.7-1.2 2.2 2.2 0 00.2-1.2c-.1-.1-.3-.2-.5-.3z"/></svg>';
  var ICON_PH = {
    decoracion: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="16" cy="16" r="8"/><circle cx="32" cy="14" r="7"/><circle cx="25" cy="27" r="7"/><path d="M16 24l3 18M32 21l-4 21M25 34v8"/></svg>',
    corporales: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="15" y="14" width="18" height="28" rx="4"/><path d="M19 14V9h10v5M20 6h8"/><path d="M20 26h8"/></svg>',
    pijamas: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M17 8l-9 6 4 7 4-2v21h16V19l4 2 4-7-9-6c-1 3-4 5-7 5s-6-2-7-5z"/></svg>'
  };
  var ICON = {
    design: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9L12 3z"/></svg>',
    trust: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    care: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 6h16v10H8l-4 4V6z"/><path d="M8 10h8M8 13h5"/></svg>'
  };

  function cardHTML(it) {
    var price = money(it.price);
    var msg = "Hola Queen's Decorations, me interesa: " + it.name + (price ? " (" + price + ")" : "") + ". ¿Me das más información?";
    var media = it.photo
      ? '<img src="' + esc(it.photo) + '" alt="' + esc(it.name) + '" loading="lazy">'
      : '<div class="ph">' + (ICON_PH[it.cat] || ICON_PH.decoracion) + '<span>Foto pronto</span></div>';
    return '<article class="card"><div class="photo">' + media +
      (it.example ? '<span class="badge ex">Ejemplo</span>' : '') +
      (it.available === false ? '<span class="badge out">Agotado</span>' : '') +
      '</div><div class="body"><span class="cat">' + esc(CATS[it.cat] || "") + '</span><h3>' + esc(it.name) + '</h3>' +
      (it.desc ? '<p class="desc">' + esc(it.desc) + '</p>' : '') +
      '<div class="row">' + (price ? '<span class="price">' + price + '</span>' : '<span class="price ask">' + (it.cat === "decoracion" ? "Cotiza tu evento" : "Precio a consultar") + '</span>') +
      '<a class="ask-btn" href="' + esc(waLink(msg)) + '" target="_blank" rel="noopener">' + (it.cat === "decoracion" ? "Cotizar" : "Pedir") + '</a></div></div></article>';
  }

  function render() {
    var c = { todo: 0, decoracion: 0, corporales: 0, pijamas: 0 };
    state.items.forEach(function (it) { c.todo++; if (c[it.cat] != null) c[it.cat]++; });
    var shown = state.items.filter(function (it) { return filter === "todo" || it.cat === filter; });
    var chips = [["todo", "Todo"], ["decoracion", CATS.decoracion], ["corporales", CATS.corporales], ["pijamas", CATS.pijamas]]
      .map(function (p) { return '<button class="chip" data-filter="' + p[0] + '" aria-pressed="' + (filter === p[0]) + '">' + p[1] + '<span class="n">' + c[p[0]] + '</span></button>'; }).join("");
    var grid = !loaded ? '<div class="empty">Cargando catálogo…</div>'
      : failed ? '<div class="empty">No se pudo cargar el catálogo. Recarga la página o escríbenos por WhatsApp.</div>'
      : shown.length ? shown.map(cardHTML).join("")
      : '<div class="empty">Pronto publicaremos novedades en esta categoría. Escríbenos y te contamos qué hay disponible.</div>';

    document.getElementById("app").innerHTML =
      '<header class="top"><div class="wrap"><a class="brand" href="#inicio" aria-label="Queen\'s Decorations"><span class="crest">' + ICON_CROWN + '</span>' +
      '<span><span class="brand-name">Queen\'s Decorations</span><br><span class="brand-tag">Hacemos realidad tus deseos</span></span></a>' +
      '<a class="wa-btn" href="' + esc(waLink("Hola Queen's Decorations, quiero información.")) + '" target="_blank" rel="noopener">' + ICON_WA + 'WhatsApp</a></div></header>' +
      '<main id="inicio"><section class="hero"><div class="wrap"><h1>Decora tus <em>momentos especiales</em></h1>' +
      '<p>Decoración de eventos sociales, productos de cuidado corporal y pijamas en Cali. Elige lo que te gusta y escríbenos por WhatsApp para pedir o cotizar.</p></div></section>' +
      '<div class="wrap"><div class="filters" role="group" aria-label="Filtrar por categoría">' + chips + '</div><div class="grid">' + grid + '</div></div>' +
      '<section class="promise"><div class="wrap">' +
      '<div>' + ICON.design + '<p style="margin:0"><strong>Diseños personalizados</strong><span>Cada evento se arma según tu idea y tu presupuesto.</span></p></div>' +
      '<div>' + ICON.trust + '<p style="margin:0"><strong>Calidad y confianza</strong><span>Productos y materiales que revisamos antes de entregar.</span></p></div>' +
      '<div>' + ICON.care + '<p style="margin:0"><strong>Atención personalizada</strong><span>Te respondemos directo por WhatsApp.</span></p></div>' +
      '</div></section></main>' +
      '<footer><div class="wrap"><span>© Queen\'s Decorations · Cali, Colombia</span>' +
      '<span>WhatsApp: <span class="phone" id="qd-phone">' + WA_SHOW + '</span><button class="copy" data-act="copy">Copiar</button></span></div></footer>';
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-filter],[data-act]");
    if (!t) return;
    if (t.dataset.filter) { filter = t.dataset.filter; render(); return; }
    if (t.dataset.act === "copy") {
      var sel = function () { var el = document.getElementById("qd-phone"); var r = document.createRange(); r.selectNodeContents(el); var s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      try { navigator.clipboard.writeText(WA_SHOW).then(function () { t.textContent = "Copiado"; setTimeout(function () { t.textContent = "Copiar"; }, 1500); }, sel); } catch (err) { sel(); }
    }
  });

  render();
  fetch("productos.json?v=" + Date.now(), { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) { state.items = Array.isArray(d.items) ? d.items : []; loaded = true; render(); })
    .catch(function () { loaded = true; failed = true; render(); });
})();
