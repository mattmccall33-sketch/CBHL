(function () {
  "use strict";

  var AWARDS = [
    ["champions", "Fattey’s Cup Champions"],
    ["runnerup", "Runners-up"],
    ["mvp", "Most Valuable Player"],
    ["defense", "Top Defense"],
    ["forward", "Top Forward"],
    ["goalie", "Top Goalie"]
  ];
  var root = document.getElementById("winners");
  var toggle = document.getElementById("edit-toggle");
  var served = null, data = null, editing = false, statusMsg = "";
  var previews = {}; // "seasonId|award" -> object URL for a photo picked but not yet uploaded

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function isDirty() { return JSON.stringify(data) !== JSON.stringify(served); }
  function slug(t) { return String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "season"; }
  function uniqueId(base) {
    var id = base, n = 2;
    while (data.seasons.some(function (s) { return s.id === id; })) id = base + "-" + n++;
    return id;
  }
  function safePhoto(p) {
    p = String(p || "").trim();
    if (!p || /^(javascript|data):/i.test(p)) return "";
    return p;
  }
  var CAMERA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>';

  function photoBox(season, key, a) {
    var src = previews[season.id + "|" + key] || safePhoto(a.photo);
    if (!src) return '<div class="photo"><div class="ph">' + CAMERA + "Photo coming soon</div></div>";
    var img = '<img src="' + esc(src) + '" alt="' + esc((a.name || "") + " – " + season.title) + '" loading="lazy">';
    return '<div class="photo">' + (editing ? img : '<a href="' + esc(src) + '" target="_blank" rel="noopener" style="display:contents">' + img + "</a>") + "</div>";
  }

  function awardCard(season, pair) {
    var key = pair[0], label = pair[1];
    var a = (season.awards && season.awards[key]) || { name: "", caption: "", photo: "" };
    var fid = season.id + "-" + key;
    var fields = editing
      ? '<div class="edit-fields">' +
        '<label>Name' + (key === "champions" || key === "runnerup" ? " (team)" : "") + '<input id="' + fid + '-name" data-s="' + esc(season.id) + '" data-k="' + key + '" data-f="name" value="' + esc(a.name) + '"></label>' +
        '<label>Caption (optional)<input id="' + fid + '-caption" data-s="' + esc(season.id) + '" data-k="' + key + '" data-f="caption" value="' + esc(a.caption) + '" placeholder="' + (key === "champions" || key === "runnerup" ? "e.g. 5-3 in the final" : "e.g. Sloppy Bandits") + '"></label>' +
        '<label>Photo<input type="file" accept="image/*" id="' + fid + '-file" data-s="' + esc(season.id) + '" data-k="' + key + '" data-f="file"></label>' +
        '<label>Photo file on GitHub<input id="' + fid + '-photo" data-s="' + esc(season.id) + '" data-k="' + key + '" data-f="photo" value="' + esc(a.photo) + '" placeholder="photos/file-name.jpg"></label>' +
        "</div>"
      : "";
    return '<article class="award' + (key === "champions" ? " cup" : "") + '">' + photoBox(season, key, a) +
      '<div class="meta"><div class="label">' + label + "</div>" +
      (editing ? "" : (a.name ? '<div class="name">' + esc(a.name) + "</div>" : '<div class="name tba">To be announced</div>') +
        (a.caption ? '<div class="cap">' + esc(a.caption) + "</div>" : "")) +
      fields + "</div></article>";
  }

  function render() {
    var html = "";
    if (editing) {
      html += '<div class="admin-intro"><h3>Editing past winners</h3><ul>' +
        "<li>Type names and pick a photo for each award. Photos show here right away as a preview.</li>" +
        "<li>When you’re done, press <b>Download winners.json</b> and upload it to your GitHub repository.</li>" +
        "<li>Upload each photo you picked into the <b>photos</b> folder on GitHub, using the same file name shown under “Photo file on GitHub.”</li></ul>" +
        '<div class="row-actions"><button type="button" class="btn small" data-act="add-season">Add a season</button></div></div>';
    } else {
      html += '<div class="page-hero"><p>Every session ends with a champion. Here are the teams that lifted the Fattey’s Cup and the players who earned the league’s individual awards.</p></div>';
    }
    html += data.seasons.map(function (s) {
      var head = editing
        ? '<div class="season-edit"><label class="sr" for="title-' + esc(s.id) + '">Season name</label><input id="title-' + esc(s.id) + '" data-s="' + esc(s.id) + '" data-f="title" value="' + esc(s.title) + '" placeholder="Spring 2027">' +
          '<button type="button" class="btn ghost small" data-act="up" data-s="' + esc(s.id) + '">Move up</button>' +
          '<button type="button" class="btn ghost small" data-act="down" data-s="' + esc(s.id) + '">Move down</button>' +
          '<button type="button" class="btn ghost small" data-act="del-season" data-s="' + esc(s.id) + '">Remove season</button></div>'
        : '<div class="sec-head"><h2>' + esc(s.title) + "</h2><p>Fattey’s Cup and individual awards</p></div>";
      return '<section class="season" id="' + esc(s.id) + '">' + head + '<div class="award-grid">' + AWARDS.map(function (p) { return awardCard(s, p); }).join("") + "</div></section>";
    }).join("");
    if (!data.seasons.length) html += '<p class="note" style="padding-block:30px">No seasons yet.</p>';
    if (editing || isDirty()) {
      var dirty = isDirty();
      html += '<div class="savebar" role="region" aria-label="Save changes"><div class="inner"><div class="msg" aria-live="polite">' +
        esc(statusMsg || (dirty ? "You have unsaved changes" : "No changes yet")) +
        "<small>" + (dirty ? "Download winners.json and upload it to GitHub to publish." : "Edit the awards above, then download winners.json.") + "</small></div>" +
        '<button type="button" class="btn ghost small" data-act="discard"' + (dirty ? "" : " disabled") + ">Discard changes</button>" +
        '<button type="button" class="btn" data-act="download"' + (dirty ? "" : " disabled") + ">Download winners.json</button></div></div>";
    }
    document.body.classList.toggle("editing", editing || isDirty());
    root.innerHTML = html;
    toggle.textContent = editing ? "Done editing" : "Edit";
    toggle.setAttribute("aria-pressed", editing);
  }

  var pending = null;
  function queueRender() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      var a = document.activeElement, id = a && a.id, y = window.scrollY;
      render();
      window.scrollTo(0, y);
      if (id) { var el = document.getElementById(id); if (el) el.focus({ preventScroll: true }); }
    }, 0);
  }
  function season(id) { return data.seasons.find(function (s) { return s.id === id; }); }
  function award(s, k) {
    s.awards = s.awards || {};
    if (!s.awards[k]) s.awards[k] = { name: "", caption: "", photo: "" };
    return s.awards[k];
  }

  root.addEventListener("change", function (e) {
    var el = e.target, f = el.dataset && el.dataset.f;
    if (!f) return;
    var s = season(el.dataset.s);
    if (!s) return;
    if (f === "title") { s.title = el.value.trim() || s.title; }
    else if (f === "file") {
      var file = el.files && el.files[0];
      if (!file) return;
      var a = award(s, el.dataset.k);
      var name = file.name.replace(/[^A-Za-z0-9._-]+/g, "-");
      a.photo = "photos/" + name;
      var key = s.id + "|" + el.dataset.k;
      if (previews[key]) URL.revokeObjectURL(previews[key]);
      previews[key] = URL.createObjectURL(file);
      statusMsg = name !== file.name ? "Photo saved as " + name + ". Rename the file to match before uploading it." : "";
    } else {
      var a2 = award(s, el.dataset.k);
      a2[f] = el.value.trim();
      if (f === "photo") delete previews[s.id + "|" + el.dataset.k];
    }
    queueRender();
  });

  root.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var act = b.dataset.act, s = b.dataset.s, i = data.seasons.findIndex(function (x) { return x.id === s; });
    if (act === "add-season") {
      var id = uniqueId(slug("new season " + Date.now().toString(36)));
      var awards = {};
      AWARDS.forEach(function (p) { awards[p[0]] = { name: "", caption: "", photo: "" }; });
      data.seasons.unshift({ id: id, title: "New season", awards: awards });
      render();
      var t = document.getElementById("title-" + id);
      if (t) { t.focus(); t.select(); }
      return;
    }
    if (act === "del-season" && i >= 0) data.seasons.splice(i, 1);
    else if (act === "up" && i > 0) data.seasons.splice(i - 1, 0, data.seasons.splice(i, 1)[0]);
    else if (act === "down" && i >= 0 && i < data.seasons.length - 1) data.seasons.splice(i + 1, 0, data.seasons.splice(i, 1)[0]);
    else if (act === "discard") { data = clone(served); previews = {}; statusMsg = ""; }
    else if (act === "download") { download(); return; }
    else return;
    queueRender();
  });

  function download() {
    // give each season a stable id based on its title before saving
    var out = clone(data);
    var seen = {};
    out.seasons.forEach(function (s) {
      if (/^new-season/.test(s.id)) {
        var base = slug(s.title), id = base, n = 2;
        while (seen[id] || out.seasons.some(function (o) { return o !== s && o.id === id; })) id = base + "-" + n++;
        s.id = id;
      }
      seen[s.id] = true;
    });
    var blob = new Blob([JSON.stringify(out, null, 1) + "\n"], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "winners.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    statusMsg = "Downloaded winners.json. Upload it and any new photos to GitHub to publish.";
    render();
  }

  toggle.addEventListener("click", function () { editing = !editing; statusMsg = ""; render(); });
  function adminCheck() {
    if (/admin/i.test(location.hash + location.search)) toggle.hidden = false;
  }
  window.addEventListener("hashchange", adminCheck);
  window.addEventListener("beforeunload", function (e) {
    if (data && isDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  fetch("winners.json", { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (d) {
      if (!d || !Array.isArray(d.seasons)) d = { seasons: [] };
      served = d; data = clone(d);
      adminCheck();
      render();
    })
    .catch(function () {
      root.innerHTML = '<p style="padding-block:40px">The winners list couldn’t be loaded. Refresh the page to try again.</p>';
    });
})();
