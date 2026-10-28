(function () {
  var CATS = { decoracion: "Decoración de eventos", corporales: "Productos corporales", pijamas: "Pijamas" };
  var API = "https://api.github.com";
  var KEY = "qd-admin";

  var cfg = { owner: "", repo: "", token: "" };
  // En GitHub Pages la dirección es usuario.github.io/repositorio/
  var host = location.hostname.match(/^([^.]+)\.github\.io$/i);
  if (host) { cfg.owner = host[1]; cfg.repo = (location.pathname.split("/")[1] || (host[1] + ".github.io")); }
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) { cfg.token = saved.token || ""; cfg.owner = cfg.owner || saved.owner || ""; cfg.repo = cfg.repo || saved.repo || ""; } } catch (e) {}

  var items = [], sha = null, connected = false;
  var draft = blank(), editingId = null, confirmDel = null, dirty = false, busy = false;
  var msg = "", kind = "";
  var previews = {}; // fotos recién subidas, mientras GitHub Pages las publica

  function blank() { return { cat: "decoracion", name: "", price: "", desc: "", photo: "", available: true }; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]; }); }
  function money(p) { var n = Number(String(p || "").replace(/[^\d]/g, "")); return n ? "$" + n.toLocaleString("es-CO") : ""; }
  function src(p) { return previews[p] || p; }
  function status(m, k) { msg = m; kind = k || ""; }
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function unb64(s) { return decodeURIComponent(escape(atob(s.replace(/\n/g, "")))); }

  function gh(path, opts) {
    opts = opts || {};
    return fetch(API + "/repos/" + cfg.owner + "/" + cfg.repo + path, {
      method: opts.method || "GET",
      headers: { "Authorization": "Bearer " + cfg.token, "Accept": "application/vnd.github+json", "Content-Type": "application/json" },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.message || ("Error " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  function explain(e) {
    if (e.status === 401) return "La clave de acceso no es válida o venció. Crea una nueva.";
    if (e.status === 403) return "La clave no tiene permiso para escribir en este repositorio. Revisa que tenga Contents en Read and write.";
    if (e.status === 404) return "No encontré el repositorio o el archivo productos.json. Revisa usuario y repositorio.";
    if (e.status === 409) return "El catálogo cambió mientras editabas. Recarga el panel y vuelve a intentarlo.";
    if (e.status === 422) return "GitHub rechazó el archivo. Si es una foto, prueba con una más liviana.";
    return "No se pudo conectar con GitHub. Revisa tu internet e inténtalo de nuevo.";
  }

  function load() {
    busy = true; status("Conectando…"); render();
    return gh("/contents/productos.json").then(function (j) {
      sha = j.sha;
      var d = JSON.parse(unb64(j.content));
      items = Array.isArray(d.items) ? d.items : [];
      connected = true; busy = false; dirty = false; status("");
      try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) {}
      render();
    }, function (e) { busy = false; connected = false; status(explain(e), "err"); render(); });
  }

  function loginHTML() {
    return '<section class="admin"><h2>Entrar al panel</h2>' +
      '<p class="hint">Este panel guarda tus productos directo en tu repositorio de GitHub. Necesitas una clave de acceso de GitHub; solo se guarda en este dispositivo.</p>' +
      '<form class="form" id="f-login">' +
      '<div class="field"><label for="l-owner">Usuario de GitHub</label><input id="l-owner" required value="' + esc(cfg.owner) + '" autocapitalize="off"></div>' +
      '<div class="field"><label for="l-repo">Repositorio</label><input id="l-repo" required value="' + esc(cfg.repo) + '" autocapitalize="off"></div>' +
      '<div class="field full"><label for="l-token">Clave de acceso (token)</label><input id="l-token" type="password" required value="' + esc(cfg.token) + '" autocomplete="off"></div>' +
      '<div class="actions field full"><button class="wa-btn" type="submit"' + (busy ? " disabled" : "") + '>Entrar</button>' +
      (msg ? '<span class="status ' + kind + '">' + esc(msg) + '</span>' : '') + '</div></form>' +
      '<p class="note">Cómo crear la clave: en GitHub ve a Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token. ' +
      'En "Repository access" elige solo este repositorio y en "Permissions" pon <strong>Contents: Read and write</strong>. ' +
      '<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Crear clave en GitHub</a></p></section>';
  }

  function editorHTML() {
    var d = draft;
    var list = items.length ? items.map(function (it) {
      var b = confirmDel === it.id
        ? '<button class="ghost danger" data-act="del-yes" data-id="' + esc(it.id) + '">Sí, eliminar</button><button class="ghost" data-act="del-no">Cancelar</button>'
        : '<button class="ghost" data-act="edit" data-id="' + esc(it.id) + '">Editar</button><button class="ghost danger" data-act="del" data-id="' + esc(it.id) + '">Eliminar</button>';
      return '<div class="item"><div class="mini">' + (it.photo ? '<img src="' + esc(src(it.photo)) + '" alt="">' : '') + '</div>' +
        '<div class="t"><strong>' + esc(it.name) + '</strong><span>' + esc(CATS[it.cat] || "") + (money(it.price) ? " · " + money(it.price) : "") + (it.available === false ? " · Agotado" : "") + (it.example ? " · Ejemplo" : "") + '</span></div>' +
        '<div class="b">' + b + '</div></div>';
    }).join("") : '<p class="hint">Todavía no hay publicaciones.</p>';

    return '<section class="admin"><h2>' + (editingId ? "Editar publicación" : "Nueva publicación") + '</h2>' +
      '<form class="form" id="f-item">' +
      '<div class="field"><label for="f-cat">Categoría</label><select id="f-cat">' + Object.keys(CATS).map(function (k) { return '<option value="' + k + '"' + (d.cat === k ? " selected" : "") + '>' + CATS[k] + '</option>'; }).join("") + '</select></div>' +
      '<div class="field"><label for="f-name">Nombre</label><input id="f-name" required maxlength="90" value="' + esc(d.name) + '" placeholder="Ej: Pijama short de algodón"></div>' +
      '<div class="field"><label for="f-price">Precio en pesos (opcional)</label><input id="f-price" inputmode="numeric" value="' + esc(d.price) + '" placeholder="Ej: 45000"></div>' +
      '<div class="field"><label for="f-photo">Foto</label><input id="f-photo" type="file" accept="image/*"' + (busy ? " disabled" : "") + '></div>' +
      (d.photo ? '<div class="field full thumb"><img src="' + esc(src(d.photo)) + '" alt="">Foto cargada <button type="button" class="ghost" data-act="rm-photo">Quitar foto</button></div>' : '') +
      '<div class="field full"><label for="f-desc">Descripción</label><textarea id="f-desc" maxlength="500" placeholder="Tallas, colores, qué incluye…">' + esc(d.desc) + '</textarea></div>' +
      '<label class="check field full"><input id="f-avail" type="checkbox"' + (d.available ? " checked" : "") + '> Disponible</label>' +
      '<div class="actions field full"><button class="wa-btn" type="submit"' + (busy ? " disabled" : "") + '>' + (editingId ? "Actualizar en la lista" : "Agregar a la lista") + '</button>' +
      (editingId ? '<button type="button" class="ghost" data-act="cancel">Cancelar edición</button>' : '') + '</div></form>' +
      '<div><h2 style="font-size:1.05rem;margin-bottom:10px">Tus publicaciones</h2><div class="list">' + list + '</div></div>' +
      '<div class="actions"><button class="wa-btn" data-act="save"' + (busy || !dirty ? " disabled" : "") + '>Publicar cambios</button>' +
      (dirty ? '<span class="status pending">Tienes cambios sin publicar</span>' : '') +
      (msg ? '<span class="status ' + kind + '">' + esc(msg) + '</span>' : '') + '</div>' +
      '<p class="note">Después de publicar, la página tarda alrededor de un minuto en mostrar los cambios. · <button class="copy" data-act="logout" style="margin:0">Salir de este dispositivo</button></p></section>';
  }

  function render() { document.getElementById("admin").innerHTML = connected ? editorHTML() : loginHTML(); }

  function readForm() {
    var n = document.getElementById("f-name"); if (!n) return;
    draft.cat = document.getElementById("f-cat").value;
    draft.name = n.value;
    draft.price = document.getElementById("f-price").value.replace(/[^\d]/g, "");
    draft.desc = document.getElementById("f-desc").value;
    draft.available = document.getElementById("f-avail").checked;
  }

  // Reduce la foto a máximo 1600 px para que cargue rápido
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.84));
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("img")); };
      img.src = url;
    });
  }

  document.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "f-login") {
      cfg.owner = document.getElementById("l-owner").value.trim();
      cfg.repo = document.getElementById("l-repo").value.trim();
      cfg.token = document.getElementById("l-token").value.trim();
      load(); return;
    }
    if (e.target.id === "f-item") {
      readForm();
      if (!draft.name.trim()) { status("Escribe un nombre para la publicación.", "err"); render(); return; }
      var data = { cat: draft.cat, name: draft.name.trim(), price: draft.price, desc: draft.desc.trim(), photo: draft.photo, available: draft.available };
      if (editingId) { items = items.map(function (x) { return x.id === editingId ? Object.assign({ id: x.id }, data) : x; }); status("Actualizada en la lista. Falta publicar."); }
      else { items.unshift(Object.assign({ id: "p" + Date.now().toString(36) }, data)); status("Agregada a la lista. Falta publicar."); }
      editingId = null; draft = blank(); dirty = true; render();
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target.id !== "f-photo" || !e.target.files || !e.target.files[0]) return;
    readForm();
    var file = e.target.files[0];
    busy = true; status("Subiendo foto…"); render();
    var path = "fotos/" + Date.now().toString(36) + ".jpg";
    shrink(file).then(function (dataUrl) {
      return gh("/contents/" + path, { method: "PUT", body: { message: "Foto nueva", content: dataUrl.split(",")[1] } }).then(function () {
        previews[path] = dataUrl; draft.photo = path; busy = false; status("Foto lista.", "ok"); render();
      });
    }).catch(function (err) {
      busy = false; status(err.message === "img" ? "No pude leer esa imagen. Usa una foto JPG o PNG." : explain(err), "err"); render();
    });
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"); if (!t) return;
    var act = t.dataset.act, id = t.dataset.id;
    readForm();
    if (act === "edit") { var it = items.find(function (x) { return x.id === id; }); if (it) { editingId = id; draft = { cat: it.cat, name: it.name, price: it.price, desc: it.desc, photo: it.photo, available: it.available !== false }; } confirmDel = null; window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (act === "cancel") { editingId = null; draft = blank(); }
    else if (act === "del") { confirmDel = id; }
    else if (act === "del-no") { confirmDel = null; }
    else if (act === "del-yes") { items = items.filter(function (x) { return x.id !== id; }); if (editingId === id) { editingId = null; draft = blank(); } confirmDel = null; dirty = true; status(""); }
    else if (act === "rm-photo") { draft.photo = ""; }
    else if (act === "logout") { try { localStorage.removeItem(KEY); } catch (err) {} cfg.token = ""; connected = false; status(""); }
    else if (act === "save") { save(); return; }
    render();
  });

  function save() {
    busy = true; status("Publicando…"); render();
    var body = JSON.stringify({ items: items }, null, 2) + "\n";
    gh("/contents/productos.json", { method: "PUT", body: { message: "Actualizar catálogo", content: b64(body), sha: sha } })
      .then(function (j) { sha = j.content.sha; busy = false; dirty = false; status("Publicado. En un minuto se ve en la página.", "ok"); render(); },
        function (err) { busy = false; status(explain(err), "err"); render(); });
  }

  window.addEventListener("beforeunload", function (e) { if (dirty) e.preventDefault(); });

  render();
  if (cfg.token && cfg.owner && cfg.repo) load();
})();
