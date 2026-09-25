(function () {
  "use strict";

  /* ---------------- state ---------------- */
  var STATIC = !(window.claude && typeof window.claude.use === "function");
  var served = null;
  var data = null;                     // what the page shows (the draft while editing)
  var editing = false;
  var artifactNs = null;
  var canWrite = false;
  var busy = false;
  var statusMsg = "";
  var restoreDraft = null;
  var statsView = "skaters";
  var sortState = { skaters: { key: "pts", dir: -1 }, goalies: { key: "gaa", dir: 1 } };
  var searchTerm = "";
  var DRAFT_KEY = "cbhl-draft-v1";
  var app = document.getElementById("app");
  var TODAY = dayKey(new Date());

  /* ---------------- helpers ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function num(v) { var n = Number(v); return Number.isFinite(n) ? n : 0; }
  function safeColor(c) { return /^#[0-9a-fA-F]{3,8}$/.test(c || "") ? c : "#8a90a6"; }
  function teamById(id) { return data.teams.find(function (t) { return t.id === id; }); }
  function chip(id) {
    var t = teamById(id);
    if (!t) return '<span class="tbd-team">TBD</span>';
    return '<span class="team"><span class="sw" style="background:' + safeColor(t.color) + '"></span>' + esc(t.name) + "</span>";
  }
  function fmtDay(d, opts) {
    if (!d) return "Date TBD";
    var dt = new Date(d + "T12:00:00");
    if (isNaN(dt)) return esc(d);
    return dt.toLocaleDateString("en-US", opts || { weekday: "long", month: "short", day: "numeric" });
  }
  function timeVal(t) {
    var m = /^(\d{1,2})(?::(\d{2}))?/.exec(t || "");
    return m ? num(m[1]) * 60 + num(m[2] || 0) : 9999;
  }
  function byDateTime(a, b) {
    return (a.date || "9999").localeCompare(b.date || "9999") || timeVal(a.time) - timeVal(b.time);
  }
  function scoreSet(v) { return v !== null && v !== undefined && v !== ""; }
  function hasScore(g) { return !!g.final && scoreSet(g.as) && scoreSet(g.hs); }
  function newId(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
  function isDirty() { return JSON.stringify(data) !== JSON.stringify(served); }

  /* ---------------- derived numbers ---------------- */
  function gameContrib() {
    var c = {};
    data.teams.forEach(function (t) { c[t.id] = { w: 0, l: 0, t: 0, gf: 0, ga: 0 }; });
    data.games.forEach(function (g) {
      if (g.inBase || !hasScore(g)) return;
      var a = c[g.away], h = c[g.home];
      if (!a || !h || g.away === g.home) return;
      var as = num(g.as), hs = num(g.hs);
      a.gf += as; a.ga += hs; h.gf += hs; h.ga += as;
      if (as > hs) { a.w++; h.l++; } else if (hs > as) { h.w++; a.l++; } else { a.t++; h.t++; }
    });
    return c;
  }
  function standings() {
    var c = gameContrib();
    return data.teams.map(function (t) {
      var b = t.base || {}, r = { id: t.id };
      ["w", "l", "t", "gf", "ga"].forEach(function (k) { r[k] = num(b[k]) + c[t.id][k]; });
      r.gp = r.w + r.l + r.t; r.pts = 2 * r.w + r.t; r.diff = r.gf - r.ga;
      return r;
    }).sort(function (x, y) { return y.pts - x.pts || y.diff - x.diff || y.gf - x.gf || x.gp - y.gp; });
  }
  function goaliePts(p) { return p.goalie ? num(p.goalie.w) + 2 * num(p.goalie.so) : 0; }
  function skaterRows() {
    return data.players.map(function (p) {
      return { id: p.id, name: p.name, g: num(p.g), a: num(p.a), pen: num(p.pen), pts: num(p.g) + num(p.a) + goaliePts(p) };
    });
  }
  function goalieRows() {
    return data.players.filter(function (p) { return p.goalie; }).map(function (p) {
      var gp = num(p.goalie.gp), ga = num(p.goalie.ga), w = num(p.goalie.w);
      return { id: p.id, name: p.name, gp: gp, w: w, so: num(p.goalie.so), ga: ga,
        gaa: gp ? ga / gp : 0, wpct: gp ? w / gp : 0, pts: goaliePts(p) };
    });
  }
  function weeks() {
    var m = new Map();
    data.games.slice().sort(byDateTime).forEach(function (g) {
      if (!m.has(g.week)) m.set(g.week, []);
      m.get(g.week).push(g);
    });
    return Array.from(m.entries()).sort(function (a, b) { return a[0] - b[0]; });
  }

  /* ---------------- view pieces ---------------- */
  function renderNext() {
    var real = data.games.filter(function (g) { return g.away && g.home && g.date >= TODAY; }).sort(byDateTime);
    var dates = [];
    real.forEach(function (g) { if (dates.indexOf(g.date) < 0) dates.push(g.date); });
    var date = dates.find(function (d) {
      return real.some(function (g) { return g.date === d && !hasScore(g); });
    });
    if (!date) return "";
    var games = real.filter(function (g) { return g.date === date; });
    var tonight = date === TODAY;
    return '<div class="next"><div class="tag">' + (tonight ? "Tonight" : "Next up") + "<b>" +
      fmtDay(date, { month: "short", day: "numeric" }) + '</b></div><div class="games">' +
      games.map(function (g) {
        var t1 = teamById(g.away), t2 = teamById(g.home);
        return '<div class="g"><time>' + esc(g.time || "TBD") + "</time>" + esc(t1 ? t1.name : "TBD") + " at " + esc(t2 ? t2.name : "TBD") + "</div>";
      }).join("") + '</div><div class="when">' + fmtDay(date) + ' · <a href="#schedule">Full schedule</a></div></div>';
  }

  function renderGame(g) {
    var score = "";
    if (hasScore(g)) {
      var as = num(g.as), hs = num(g.hs);
      score = '<div class="score"><span class="' + (as > hs ? "w" : as < hs ? "lose" : "") + '">' + as + '</span><span class="fin">FINAL</span><span class="' + (hs > as ? "w" : hs < as ? "lose" : "") + '">' + hs + "</span></div>";
    }
    var refs = [g.ref1, g.ref2].filter(Boolean).map(esc).join(" &amp; ");
    return '<div class="game"><time>' + esc(g.time || "TBD") + '</time><div class="matchup">' + chip(g.away) +
      '<span class="at">at</span>' + chip(g.home) + "</div>" + score +
      (refs ? '<div class="refs">Refs: ' + refs + "</div>" : "") + "</div>";
  }

  function renderSchedule() {
    return weeks().map(function (entry) {
      var wk = entry[0], games = entry[1];
      var dates = [];
      games.forEach(function (g) { if (dates.indexOf(g.date) < 0) dates.push(g.date); });
      var real = dates.filter(Boolean);
      var st = "upcoming", label = "Upcoming";
      if (real.indexOf(TODAY) >= 0) { st = "today"; label = "Game night"; }
      else if (real.length && real[real.length - 1] < TODAY) { st = "played"; label = "Played"; }
      var days = dates.map(function (d) {
        var dg = games.filter(function (g) { return g.date === d; });
        var shown = dg.filter(function (g) { return g.away || g.home; });
        var head = "<h3>" + fmtDay(d) + (d === TODAY ? " · Tonight" : "") + "</h3>";
        if (!shown.length) return '<div class="day">' + head + '</div><div class="tbd">Matchups to be announced</div>';
        return '<div class="day">' + head + shown.map(renderGame).join("") + "</div>";
      }).join("");
      return '<article class="week' + (st === "played" ? " is-past" : "") + '"><header><div class="wk"><small>WEEK</small>' + esc(wk) +
        '</div><span class="status ' + st + '">' + label + "</span></header>" + days + "</article>";
    }).join("");
  }

  var STAND_COLS = [["rank", "#", "rank"], ["team", "Team", "l"], ["gp", "GP"], ["w", "W"], ["l", "L"], ["t", "T"], ["pts", "PTS"], ["gf", "GF"], ["ga", "GA"], ["diff", "DIFF"]];
  var standSort = { key: "rank", dir: 1 };
  function standingsHead() {
    return "<tr>" + STAND_COLS.map(function (c) {
      var aria = c[0] === standSort.key ? ' aria-sort="' + (standSort.dir < 0 ? "descending" : "ascending") + '"' : "";
      return '<th class="' + (c[2] || "") + '"' + aria + '><button type="button" class="sort" data-ssort="' + c[0] + '">' + c[1] + "</button></th>";
    }).join("") + "</tr>";
  }
  function renderStandings() {
    var rows = standings().map(function (r, i) {
      r.rank = i + 1; var t = teamById(r.id); r.team = t ? t.name : ""; return r;
    });
    var k = standSort.key, d = standSort.dir;
    rows.sort(function (a, b) {
      var x = a[k], y = b[k];
      if (typeof x === "string") return d * x.localeCompare(y);
      return d * (x - y) || a.rank - b.rank;
    });
    return rows.map(function (r) {
      return '<tr><td class="rank">' + r.rank + '</td><td class="l">' + chip(r.id) + "</td><td>" + r.gp + "</td><td>" + r.w +
        "</td><td>" + r.l + "</td><td>" + r.t + '</td><td class="pts">' + r.pts + "</td><td>" + r.gf + "</td><td>" + r.ga +
        "</td><td>" + (r.diff > 0 ? "+" + r.diff : r.diff) + "</td></tr>";
    }).join("");
  }

  var STAT_COLS = {
    skaters: [["name", "Player", "l"], ["g", "G"], ["a", "A"], ["pen", "PEN"], ["pts", "PTS", "pts"]],
    goalies: [["name", "Goalie", "l"], ["gp", "GP"], ["w", "W"], ["so", "SO"], ["ga", "GA"], ["gaa", "GAA"], ["wpct", "W%"], ["pts", "PTS", "pts"]]
  };
  function fmtStat(k, v) {
    if (k === "gaa") return v.toFixed(2);
    if (k === "wpct") return v.toFixed(3).replace(/^0/, "");
    return esc(v);
  }
  function statsHead() {
    var s = sortState[statsView];
    return "<tr><th class='rank'>#</th>" + STAT_COLS[statsView].map(function (c) {
      var aria = c[0] === s.key ? ' aria-sort="' + (s.dir < 0 ? "descending" : "ascending") + '"' : "";
      return '<th class="' + (c[2] === "l" ? "l" : "") + '"' + aria + '><button type="button" class="sort" data-sort="' + c[0] + '">' + c[1] + "</button></th>";
    }).join("") + "</tr>";
  }
  function statsBody() {
    var s = sortState[statsView], cols = STAT_COLS[statsView];
    var rows = (statsView === "skaters" ? skaterRows() : goalieRows()).sort(function (a, b) {
      var x = a[s.key], y = b[s.key];
      if (typeof x === "string") return s.dir * x.localeCompare(y);
      return s.dir * (x - y) || a.name.localeCompare(b.name);
    });
    var term = searchTerm.trim().toLowerCase();
    var out = rows.map(function (r, i) { return { r: r, i: i }; })
      .filter(function (o) { return !term || o.r.name.toLowerCase().indexOf(term) >= 0; })
      .map(function (o) {
        return '<tr><td class="rank">' + (o.i + 1) + "</td>" + cols.map(function (c) {
          return '<td class="' + (c[2] || "") + '">' + fmtStat(c[0], o.r[c[0]]) + "</td>";
        }).join("") + "</tr>";
      }).join("");
    return out || '<tr><td colspan="' + (cols.length + 1) + '" class="l" style="color:var(--ink-2)">No player matches “' + esc(searchTerm) + "”.</td></tr>";
  }
  function statsNote() {
    return statsView === "goalies"
      ? "GAA = goals against per game. Goalie points: 1 per win, 2 per shutout."
      : "PTS = goals + assists, plus goalie points for anyone who has played in net.";
  }

  /* ---------------- admin editors ---------------- */
  function teamOptions(sel) {
    return '<option value="">TBD</option>' + data.teams.map(function (t) {
      return '<option value="' + esc(t.id) + '"' + (t.id === sel ? " selected" : "") + ">" + esc(t.name) + "</option>";
    }).join("");
  }
  function inp(kind, id, field, value, attrs) {
    return '<input id="' + kind + "-" + esc(id) + "-" + field + '" data-kind="' + kind + '" data-id="' + esc(id) + '" data-f="' + field + '" value="' + esc(value == null ? "" : value) + '" ' + (attrs || "") + ">";
  }
  function adminSchedule() {
    var html = '<div class="table-box"><table class="edit-table"><thead><tr><th>Date</th><th>Time</th><th class="l">Away</th><th>Score</th><th class="l">Home</th><th>Score</th><th>Final</th><th>Ref 1</th><th>Ref 2</th><th><span class="sr">Remove</span></th></tr></thead><tbody>';
    weeks().forEach(function (entry) {
      var wk = entry[0];
      html += '<tr class="wk-row"><td colspan="10">Week ' + esc(wk) + '<button type="button" class="btn ghost small" data-act="add-game" data-week="' + esc(wk) + '">Add game</button></td></tr>';
      entry[1].forEach(function (g) {
        var id = g.id;
        html += "<tr>" +
          "<td>" + inp("game", id, "date", g.date, 'type="date" aria-label="Date"') + "</td>" +
          "<td>" + inp("game", id, "time", g.time, 'class="time" aria-label="Time" placeholder="6:00"') + "</td>" +
          '<td class="l"><select id="game-' + esc(id) + '-away" data-kind="game" data-id="' + esc(id) + '" data-f="away" aria-label="Away team">' + teamOptions(g.away) + "</select></td>" +
          "<td>" + inp("game", id, "as", g.as, 'type="number" min="0" aria-label="Away score"') + "</td>" +
          '<td class="l"><select id="game-' + esc(id) + '-home" data-kind="game" data-id="' + esc(id) + '" data-f="home" aria-label="Home team">' + teamOptions(g.home) + "</select></td>" +
          "<td>" + inp("game", id, "hs", g.hs, 'type="number" min="0" aria-label="Home score"') + "</td>" +
          '<td><input type="checkbox" id="game-' + esc(id) + '-final" data-kind="game" data-id="' + esc(id) + '" data-f="final" aria-label="Final"' + (g.final ? " checked" : "") + "></td>" +
          "<td>" + inp("game", id, "ref1", g.ref1, 'class="ref" aria-label="Ref 1"') + "</td>" +
          "<td>" + inp("game", id, "ref2", g.ref2, 'class="ref" aria-label="Ref 2"') + "</td>" +
          '<td><button type="button" class="del" data-act="del-game" data-id="' + esc(id) + '" aria-label="Remove game" title="Remove game">✕</button></td></tr>';
      });
    });
    html += '</tbody></table></div><div class="row-actions"><button type="button" class="btn ghost small" data-act="add-week">Add a week</button></div>' +
      '<p class="hint">Enter both scores and tick <b>Final</b> to post a result. Final scores update the standings automatically. Leave a team as TBD to show “Matchups to be announced.”</p>';
    return html;
  }
  function adminStandings() {
    var tot = {};
    standings().forEach(function (r) { tot[r.id] = r; });
    var rows = data.teams.map(function (t) {
      var r = tot[t.id], id = t.id;
      return '<tr><td class="l">' + inp("team", id, "name", t.name, 'class="name" aria-label="Team name"') + "</td>" +
        "<td>" + inp("team", id, "color", safeColor(t.color), 'type="color" aria-label="Team color" style="width:3em;padding:2px"') + "</td>" +
        ["w", "l", "t", "gf", "ga"].map(function (k) {
          return "<td>" + inp("team", id, k, r[k], 'type="number" min="0" aria-label="' + k.toUpperCase() + '"') + "</td>";
        }).join("") + '<td class="pts">' + r.pts + "</td></tr>";
    }).join("");
    return '<div class="table-box"><table class="edit-table"><thead><tr><th class="l">Team</th><th>Color</th><th>W</th><th>L</th><th>T</th><th>GF</th><th>GA</th><th>PTS</th></tr></thead><tbody>' +
      rows + '</tbody></table></div><p class="hint">These totals already include every final score on the schedule. Change a number here only to correct it by hand.</p>';
  }
  function adminStats() {
    var list = data.players.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    var rows = list.map(function (p) {
      var id = p.id, g = p.goalie || {}, dis = p.goalie ? "" : " disabled";
      return '<tr><td class="l">' + inp("player", id, "name", p.name, 'class="name" aria-label="Player name" placeholder="Last, First"') + "</td>" +
        "<td>" + inp("player", id, "g", p.g, 'type="number" min="0" aria-label="Goals"') + "</td>" +
        "<td>" + inp("player", id, "a", p.a, 'type="number" min="0" aria-label="Assists"') + "</td>" +
        "<td>" + inp("player", id, "pen", p.pen, 'type="number" min="0" aria-label="Penalties"') + "</td>" +
        '<td><input type="checkbox" id="player-' + esc(id) + '-isg" data-kind="player" data-id="' + esc(id) + '" data-f="isg" aria-label="Plays goalie"' + (p.goalie ? " checked" : "") + "></td>" +
        ["gp", "w", "so", "ga"].map(function (k) {
          return "<td>" + inp("player", id, "g_" + k, p.goalie ? g[k] : "", 'type="number" min="0" aria-label="Goalie ' + k.toUpperCase() + '"' + dis) + "</td>";
        }).join("") +
        '<td><button type="button" class="del" data-act="del-player" data-id="' + esc(id) + '" aria-label="Remove player" title="Remove player">✕</button></td></tr>';
    }).join("");
    return '<div class="tools"><button type="button" class="btn ghost small" data-act="add-player">Add player</button></div>' +
      '<div class="table-box"><table class="edit-table"><thead><tr><th class="l">Player</th><th>G</th><th>A</th><th>PEN</th><th>Goalie</th><th>GP</th><th>W</th><th>SO</th><th>GA</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div><p class="hint">Enter season totals. Points, GAA and W% are calculated for you. Tick <b>Goalie</b> to track a player’s goalie numbers.</p>';
  }

  /* ---------------- page ---------------- */
  function render() {
    var dirty = isDirty();
    document.body.classList.toggle("editing", editing || dirty);
    var html =
      '<header class="masthead"><div class="wrap mast-inner"><img src="cbhl-logo.png" alt="Columbus Ball Hockey League crest"><div>' +
      '<p class="eyebrow">Est. 2026 · ' + esc(data.season || "") + "</p><h1>Columbus Ball<br>Hockey <span>League</span></h1>" +
      '<p class="mast-meta">Tuesday &amp; Thursday nights · 6:00 and 7:00 puck drops · ' + data.teams.length + " teams</p></div></div></header>" +
      '<nav class="tabs" aria-label="Sections"><div class="bar"><ul>' +
      '<li><a href="#schedule">Schedule</a></li><li><a href="#standings">Standings</a></li><li><a href="#stats">Stats</a></li><li><a href="#rules">Rule Book</a></li><li><a href="#contact">Contact</a></li></ul>' +
      '<button type="button" class="edit-toggle" id="edit-toggle" data-act="toggle-edit" aria-pressed="' + editing + '"' + (canWrite ? "" : " hidden") + ">" + (editing ? "Done editing" : "Edit") + "</button></div></nav>" +
      '<main class="wrap">' +
      (restoreDraft ? '<div class="restore"><span>You have unsaved edits from earlier in this browser.</span><button type="button" class="btn small" data-act="restore">Restore edits</button><button type="button" class="btn ghost small" data-act="drop-draft">Discard</button></div>' : "") +
      (editing ? (STATIC
        ? '<div class="admin-intro"><h3>Editing league data</h3><ul><li>Make your changes below, then press <b>Download data.json</b>.</li><li>Upload that file to your GitHub repository, replacing the old data.json. The site updates in a minute or two.</li><li>Press <b>Done editing</b> to preview before downloading.</li></ul></div>'
        : '<div class="admin-intro"><h3>Editing league data</h3><ul><li>Changes stay on your screen until you press <b>Publish changes</b>.</li><li>Publishing updates the page for everyone who opens it.</li><li>Press <b>Done editing</b> to preview before publishing.</li></ul></div>') : renderNext()) +
      '<section id="schedule"><div class="sec-head"><h2>Schedule</h2><p>' + (editing ? "Edit games and post scores" : "Home team listed second") + "</p></div>" +
      (editing ? adminSchedule() : '<ul class="legend">' + data.teams.map(function (t) { return "<li>" + chip(t.id) + "</li>"; }).join("") + '</ul><div class="weeks">' + renderSchedule() + "</div>") +
      "</section>" +
      '<section id="standings"><div class="sec-head"><h2>Standings</h2><p>2 points for a win, 1 for a tie</p></div>' +
      (editing ? adminStandings() : '<div class="table-box"><table id="standings-table"><thead>' + standingsHead() + '</thead><tbody id="standings-body">' + renderStandings() + "</tbody></table></div>") +
      "</section>" +
      '<section id="stats"><div class="sec-head"><h2>Stats</h2><p>' + (editing ? "Season totals" : "Click a column to sort") + "</p></div>" +
      (editing ? adminStats() :
        '<div class="tools"><div class="seg" role="group" aria-label="Stat type"><button type="button" data-act="view" data-v="skaters" aria-pressed="' + (statsView === "skaters") + '">Skaters</button><button type="button" data-act="view" data-v="goalies" aria-pressed="' + (statsView === "goalies") + '">Goalies</button></div>' +
        '<input class="search" id="player-search" type="search" placeholder="Find a player" aria-label="Find a player" value="' + esc(searchTerm) + '"></div>' +
        '<div class="table-box"><table id="stats-table"><thead>' + statsHead() + '</thead><tbody id="stats-body">' + statsBody() + '</tbody></table></div><p class="note">' + statsNote() + "</p>") +
      "</section>" +
      '<section id="rules"><div class="sec-head"><h2>Rule Book</h2><p>Version 0.1</p></div><div class="rule-card">' +
      '<div class="book" aria-hidden="true"><img src="cbhl-logo.png" alt=""><span>Official<br>Rule Book</span></div><div>' +
      "<h3>CBHL Official Rule Book</h3><p>Based on the USA Ball Hockey Official Rule Book (Rev. 07.06.2021) with CBHL-specific amendments. League rules marked with a " +
      '<span class="star">★</span> gold star supersede the USA Ball Hockey rule book in all cases. Includes the codes of conduct for players, coaches, officials and spectators.</p>' +
      '<a class="btn" href="' + esc(data.rulebook || "CBHL_Official_Rulebook.pdf") + '" target="_blank" rel="noopener">Open the Rule Book (PDF)</a></div></div></section>' +
      renderContact() +
      "</main>" +
      '<footer><div class="wrap">Columbus Ball Hockey League · Est. 2026 · <a href="https://www.facebook.com/profile.php?id=61587629577464" target="_blank" rel="noopener">Facebook</a> · <a href="https://www.instagram.com/cbusballhockey/" target="_blank" rel="noopener">Instagram</a> · Last updated ' + fmtDay(data.updated, { month: "long", day: "numeric", year: "numeric" }) + "</div></footer>" +
      ((editing || dirty) ? renderSavebar(dirty) : "");
    app.innerHTML = html;
    observeNav();
  }

  function renderContact() {
    var email = data.contact || "mattmccall33@gmail.com";
    return '<section id="contact"><div class="sec-head"><h2>Contact</h2><p>Questions, sign-ups and subs</p></div>' +
      '<div class="contact-grid"><div class="contact-card"><h3>Get in touch</h3>' +
      "<p>Want to join a team, find a sub, or ask about the rules? Email the league.</p>" +
      '<div class="contact-actions"><a class="btn" href="mailto:' + esc(email) + '?subject=' + encodeURIComponent("CBHL question") + '">Email the league</a></div>' +
      '<h4 class="follow-head">Follow the league</h4><div class="contact-actions">' +
      '<a class="btn social fb" href="https://www.facebook.com/profile.php?id=61587629577464" target="_blank" rel="noopener">Facebook</a>' +
      '<a class="btn social ig" href="https://www.instagram.com/cbusballhockey/" target="_blank" rel="noopener">Instagram</a>' +
      "</div></div>" +
      '<div class="partners"><h3>Ball hockey links</h3><div class="partner-row">' +
      '<a class="partner partner-wide" href="https://thenbhl.com/" target="_blank" rel="noopener"><img src="nbhl.jpg" alt="NBHL: Hockey. In sneakers." width="650" height="158"><span>National Ball Hockey League</span></a>' +
      '<a class="partner partner-usa" href="https://usaballhockey.com/" target="_blank" rel="noopener"><img src="usaballhockey.jpg" alt="USA Ball Hockey" width="88" height="53"><span>USA Ball Hockey</span></a>' +
      "</div></div></div></section>";
  }

  function renderSavebar(dirty) {
    return '<div class="savebar" role="region" aria-label="Save changes"><div class="inner"><div class="msg" aria-live="polite">' +
      (statusMsg ? esc(statusMsg) : dirty ? "You have unpublished changes" : "No changes yet") +
      "<small>" + (STATIC
        ? (dirty ? "Download data.json and upload it to GitHub to publish." : "Edit the tables below, then download data.json.")
        : (dirty ? "Only you can see them until you publish." : "Edit the tables below, then publish.")) + "</small></div>" +
      '<button type="button" class="btn ghost small" data-act="discard"' + (dirty && !busy ? "" : " disabled") + ">Discard changes</button>" +
      '<button type="button" class="btn" data-act="publish"' + (dirty && !busy ? "" : " disabled") + ">" +
      (busy ? "Publishing…" : STATIC ? "Download data.json" : "Publish changes") + "</button></div></div>";
  }

  var io = null;
  function observeNav() {
    if (!("IntersectionObserver" in window)) return;
    if (io) io.disconnect();
    var links = Array.prototype.slice.call(document.querySelectorAll("nav.tabs a"));
    io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) links.forEach(function (a) { a.setAttribute("aria-current", a.hash === "#" + e.target.id); });
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll("main section").forEach(function (s) { io.observe(s); });
  }

  var pending = null;
  function queueRender() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      var a = document.activeElement, id = a && a.id;
      var y = window.scrollY;
      render();
      window.scrollTo(0, y);
      if (id) { var el = document.getElementById(id); if (el) el.focus({ preventScroll: true }); }
    }, 0);
  }

  /* ---------------- draft stash ---------------- */
  function stash() {
    try {
      if (isDirty()) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(data));
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch (e) { /* storage unavailable */ }
  }
  function loadStash() {
    try {
      var s = sessionStorage.getItem(DRAFT_KEY);
      if (!s) return null;
      var d = JSON.parse(s);
      if (JSON.stringify(d) === JSON.stringify(served)) { sessionStorage.removeItem(DRAFT_KEY); return null; }
      return d;
    } catch (e) { return null; }
  }

  /* ---------------- edits ---------------- */
  function onChange(e) {
    var el = e.target;
    if (!el.dataset || !el.dataset.kind) return;
    var kind = el.dataset.kind, id = el.dataset.id, f = el.dataset.f;
    var val = el.type === "checkbox" ? el.checked : el.value;
    if (kind === "game") {
      var g = data.games.find(function (x) { return x.id === id; });
      if (!g) return;
      if (f === "as" || f === "hs") g[f] = val === "" ? null : Math.max(0, Math.round(num(val)));
      else if (f === "final") g.final = !!val;
      else g[f] = String(val).trim();
      if ((f === "as" || f === "hs") && scoreSet(g.as) && scoreSet(g.hs) && !g._touchedFinal) g.final = true;
      if (f === "final") g._touchedFinal = true;
    } else if (kind === "team") {
      var t = data.teams.find(function (x) { return x.id === id; });
      if (!t) return;
      if (f === "name") t.name = String(val).trim() || t.name;
      else if (f === "color") t.color = safeColor(val);
      else {
        var contrib = gameContrib()[id][f];
        t.base = t.base || {};
        t.base[f] = Math.round(num(val)) - contrib;
      }
    } else if (kind === "player") {
      var p = data.players.find(function (x) { return x.id === id; });
      if (!p) return;
      if (f === "name") p.name = String(val).trim();
      else if (f === "isg") p.goalie = val ? (p.goalie || { gp: 0, w: 0, so: 0, ga: 0 }) : null;
      else if (f.indexOf("g_") === 0) { if (p.goalie) p.goalie[f.slice(2)] = Math.max(0, Math.round(num(val))); }
      else p[f] = Math.max(0, Math.round(num(val)));
    }
    cleanTransient();
    statusMsg = "";
    stash();
    queueRender();
  }
  function cleanTransient() {
    // _touchedFinal only matters during this editing session; never publish it
  }

  function onClick(e) {
    var b = e.target.closest("[data-act],[data-sort],[data-ssort]");
    if (!b) return;
    if (b.dataset.ssort) {
      var sk = b.dataset.ssort;
      if (standSort.key === sk) standSort.dir *= -1;
      else standSort = { key: sk, dir: sk === "rank" || sk === "team" || sk === "l" || sk === "ga" ? 1 : -1 };
      document.querySelector("#standings-table thead").innerHTML = standingsHead();
      document.getElementById("standings-body").innerHTML = renderStandings();
      return;
    }
    if (b.dataset.sort) {
      var s = sortState[statsView], k = b.dataset.sort;
      if (s.key === k) s.dir *= -1;
      else { s.key = k; s.dir = k === "name" || k === "gaa" || k === "ga" ? 1 : -1; }
      document.querySelector("#stats-table thead").innerHTML = statsHead();
      document.getElementById("stats-body").innerHTML = statsBody();
      return;
    }
    var act = b.dataset.act;
    if (act === "view") { statsView = b.dataset.v; render(); return; }
    if (act === "toggle-edit") { editing = !editing; statusMsg = ""; render(); if (editing) document.getElementById("schedule").scrollIntoView(); return; }
    if (act === "restore") { data = restoreDraft; restoreDraft = null; editing = true; render(); return; }
    if (act === "drop-draft") { restoreDraft = null; try { sessionStorage.removeItem(DRAFT_KEY); } catch (x) {} render(); return; }
    if (act === "discard") { data = clone(served); statusMsg = ""; stash(); render(); return; }
    if (act === "publish") { publish(); return; }
    if (act === "copy-email") {
      var em = b.dataset.email;
      var done = function () { b.textContent = "Copied"; setTimeout(function () { b.textContent = "Copy address"; }, 1800); };
      var fallback = function () {
        var s = b.parentNode.querySelector(".email"); var r = document.createRange(); r.selectNodeContents(s);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        b.textContent = "Press Ctrl+C to copy";
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(em).then(done, fallback);
      else fallback();
      return;
    }
    if (act === "add-game") {
      var wk = num(b.dataset.week);
      var inWeek = data.games.filter(function (g) { return g.week === wk; }).sort(byDateTime);
      var last = inWeek[inWeek.length - 1];
      data.games.push({ id: newId("g"), week: wk, date: last ? last.date : "", time: "", away: "", home: "", ref1: "", ref2: "", as: null, hs: null, final: false, inBase: false });
    } else if (act === "add-week") {
      var maxWk = data.games.reduce(function (m, g) { return Math.max(m, num(g.week)); }, 0);
      var lastDate = data.games.map(function (g) { return g.date; }).filter(Boolean).sort().pop();
      var nd = "";
      if (lastDate) { var d = new Date(lastDate + "T12:00:00"); d.setDate(d.getDate() + 7); nd = dayKey(d); }
      data.games.push({ id: newId("g"), week: maxWk + 1, date: nd, time: "", away: "", home: "", ref1: "", ref2: "", as: null, hs: null, final: false, inBase: false });
    } else if (act === "del-game") {
      data.games = data.games.filter(function (g) { return g.id !== b.dataset.id; });
    } else if (act === "add-player") {
      var np = { id: newId("p"), name: "", g: 0, a: 0, pen: 0, goalie: null };
      data.players.push(np);
      stash(); render();
      var el = document.getElementById("player-" + np.id + "-name");
      if (el) { el.scrollIntoView({ block: "center" }); el.focus(); }
      return;
    } else if (act === "del-player") {
      data.players = data.players.filter(function (p) { return p.id !== b.dataset.id; });
    } else return;
    statusMsg = "";
    stash();
    queueRender();
  }

  function onInput(e) {
    if (e.target.id === "player-search") {
      searchTerm = e.target.value;
      document.getElementById("stats-body").innerHTML = statsBody();
    }
  }

  /* ---------------- publishing ---------------- */
  function publishable(d) {
    var out = clone(d);
    out.games.forEach(function (g) { delete g._touchedFinal; });
    out.players = out.players.filter(function (p) { return p.name; });
    out.updated = TODAY;
    return out;
  }
  function buildHtml(d) {
    var json = JSON.stringify(d, null, 1).replace(/</g, "\\u003c");
    return '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      "<title>Columbus Ball Hockey League</title>\n" +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;800;900&family=Barlow:wght@400;500;600;700&display=swap">\n' +
      '<link rel="stylesheet" href="app.css">\n</head>\n<body>\n<div id="app"></div>\n' +
      '<script type="application/json" id="league-data">' + json + "</" + "script>\n" +
      '<script src="app.js"></' + "script>\n</body>\n</html>\n";
  }
  function downloadJson() {
    var out = publishable(data);
    var blob = new Blob([JSON.stringify(out, null, 1) + "\n"], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = "data.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    statusMsg = "Downloaded data.json. Upload it to GitHub to publish.";
    render();
  }
  function publish(retried) {
    if (busy) return;
    if (STATIC) { downloadJson(); return; }
    if (!artifactNs) { statusMsg = "Saving isn’t available in this view. Open the page in Claude to publish."; render(); return; }
    var out = publishable(data);
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(out)); } catch (x) {}
    busy = true; statusMsg = "Publishing…"; render();
    artifactNs.publish(buildHtml(out)).then(function () {
      statusMsg = "Published. Reloading with your changes…";
      busy = false; render();
    }, function (err) {
      busy = false;
      var code = err && err.code;
      if (code === "conflict") statusMsg = "Someone else published a newer version. The page is reloading; use Restore edits to bring your changes back.";
      else if (code === "not_writer" || code === "not_granted" || code === "consent_required" || code === "capability_disabled" || code === "not_declared") {
        statusMsg = "This view is read-only. Only league admins can publish changes.";
        canWrite = false; editing = false;
      }
      else if (code === "rate_limited") statusMsg = "Publishing too often. Wait a minute, then publish again.";
      else if (code === "too_large") statusMsg = "The page is too large to save. Remove some rows and try again.";
      else if (!retried && (code === "upstream_error" || !code)) {
        setTimeout(function () { publish(true); }, 800 + Math.random() * 800);
        return;
      } else statusMsg = "Couldn’t publish. Check your connection and try again.";
      render();
    });
  }

  /* ---------------- boot ---------------- */
  function start(d) {
    served = d;
    data = clone(served);
    app.addEventListener("change", onChange);
    app.addEventListener("click", onClick);
    app.addEventListener("input", onInput);
    if (STATIC) {
      var adminCheck = function () {
        var on = /admin/i.test(location.hash + location.search);
        if (on && !canWrite) { canWrite = true; restoreDraft = loadStash(); render(); }
      };
      window.addEventListener("hashchange", adminCheck);
      adminCheck();
    }
    render();
    if (!STATIC) lightUp();
  }

  var inline = document.getElementById("league-data");
  if (inline) start(JSON.parse(inline.textContent));
  else {
    app.innerHTML = '<p class="wrap" style="padding-block:40px">Loading league data…</p>';
    fetch("data.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(start)
      .catch(function () {
        app.innerHTML = '<p class="wrap" style="padding-block:40px">The league data couldn’t be loaded. Refresh the page to try again.</p>';
      });
  }

  function lightUp() {
    var c = window.claude;
    if (!c || typeof c.use !== "function") return;
    Promise.all([c.use("artifact"), c.use("user")]).then(function (res) {
      var art = res[0], user = res[1];
      if (!art) return;
      artifactNs = art;
      return (user ? user.canEdit() : Promise.resolve(null)).then(function (ok) {
        if (ok === false) return;
        canWrite = true;
        restoreDraft = loadStash();
        render();
      });
    }).catch(function () { /* page stays read-only */ });
  }
})();
