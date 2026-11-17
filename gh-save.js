/* CBHL: save edits straight to the GitHub repository from the edit screens.
   The access token is kept only in this browser (localStorage) and is sent only to api.github.com. */
(function () {
  "use strict";
  var KEY = "cbhl-github-v1";
  var API = "https://api.github.com";

  function guess() {
    var host = location.hostname, seg = location.pathname.split("/").filter(Boolean)[0] || "";
    if (/\.github\.io$/i.test(host)) {
      var owner = host.split(".")[0];
      return { owner: owner, repo: seg && !/\.html?$/i.test(seg) ? seg : owner + ".github.io" };
    }
    return { owner: "", repo: "" };
  }
  function load() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { s = {}; }
    var g = guess();
    return { owner: s.owner || g.owner, repo: s.repo || g.repo, branch: s.branch || "main", token: s.token || "", ok: !!s.ok };
  }
  function store(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }
  var settings = load();

  function ready() { return !!(settings.owner && settings.repo && settings.token && settings.ok); }

  function req(method, url, body) {
    return fetch(API + url, {
      method: method,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": "Bearer " + settings.token,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (r.ok) return j;
        var code = r.status === 401 ? "bad_token" : r.status === 403 ? "no_permission" : r.status === 404 ? "not_found"
          : (r.status === 409 || r.status === 422) ? "conflict" : "http_" + r.status;
        var err = new Error((j && j.message) || ("GitHub returned " + r.status)); err.code = code; err.status = r.status;
        throw err;
      });
    }, function () { var e = new Error("network"); e.code = "network"; throw e; });
  }
  function repoPath(path) {
    return "/repos/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repo) +
      "/contents/" + path.split("/").map(encodeURIComponent).join("/");
  }
  function utf8ToB64(text) {
    var bytes = new TextEncoder().encode(text), bin = "";
    for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function b64ToUtf8(b64) {
    var bin = atob(String(b64).replace(/\s/g, "")), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  /* Read a file from the repository. Resolves {text, sha} or null if it doesn't exist. */
  function getFile(path) {
    return req("GET", repoPath(path) + "?ref=" + encodeURIComponent(settings.branch)).then(function (j) {
      return { text: j.content ? b64ToUtf8(j.content) : "", sha: j.sha };
    }, function (e) { if (e.code === "not_found") return null; throw e; });
  }
  function getSha(path) {
    return getFile(path).then(function (f) { return f ? f.sha : null; });
  }
  /* Create or replace a file. content is base64. Resolves the new sha. */
  function putB64(path, b64, message, sha) {
    var body = { message: message, content: b64, branch: settings.branch };
    if (sha) body.sha = sha;
    return req("PUT", repoPath(path), body).then(function (j) { return j && j.content ? j.content.sha : null; });
  }
  function putText(path, text, message, sha) { return putB64(path, utf8ToB64(text), message, sha); }

  /* Shrink a photo before upload so the repository stays small. Resolves base64 JPEG. */
  function photoB64(file, maxSide) {
    maxSide = maxSide || 1600;
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, maxSide / Math.max(w, h));
        var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.86).split(",")[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("That photo couldn’t be read. Try a JPG or PNG.")); };
      img.src = url;
    });
  }

  function explain(e) {
    switch (e && e.code) {
      case "bad_token": return "GitHub didn’t accept the access token. It may be mistyped or expired. Update it under GitHub connection.";
      case "no_permission": return "The access token can’t write to this repository. Give it Contents: Read and write access to the repository.";
      case "not_found": return "GitHub couldn’t find that repository. Check the owner and repository name, and that the token includes this repository.";
      case "conflict": return "The file on GitHub changed since you opened this page. Reload the page to get the latest version, then make your edits again.";
      case "network": return "Couldn’t reach GitHub. Check your internet connection and try again.";
      default: return "GitHub couldn’t save: " + ((e && e.message) || "unknown error") + ".";
    }
  }

  /* ---------- connection panel (rendered into a container on the edit screen) ---------- */
  var panelMsg = "";
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function mountPanel(el, onChange) {
    if (!el) return;
    var open = !ready();
    el.innerHTML =
      '<details class="gh-panel card"' + (open ? " open" : "") + "><summary>" +
      '<span class="gh-dot ' + (ready() ? "on" : "off") + '" aria-hidden="true"></span>' +
      "<b>GitHub connection</b> <span class=\"gh-status\">" +
      (ready() ? "Saving straight to " + esc(settings.owner) + "/" + esc(settings.repo) : "Not connected. Edits must be downloaded and uploaded by hand.") +
      "</span></summary>" +
      '<div class="gh-body"><p class="hint">Connect once on each device you edit from. The access token is stored only in this browser and is only sent to GitHub. See <b>EDITING.md</b> in the repository for how to create one.</p>' +
      '<div class="gh-fields">' +
      '<label>GitHub username or organization<input id="gh-owner" value="' + esc(settings.owner) + '" autocomplete="off" spellcheck="false"></label>' +
      '<label>Repository name<input id="gh-repo" value="' + esc(settings.repo) + '" autocomplete="off" spellcheck="false"></label>' +
      '<label>Branch<input id="gh-branch" value="' + esc(settings.branch) + '" autocomplete="off" spellcheck="false"></label>' +
      '<label>Access token<input id="gh-token" type="password" value="' + esc(settings.token) + '" placeholder="github_pat_…" autocomplete="off" spellcheck="false"></label>' +
      "</div>" +
      '<div class="contact-actions"><button type="button" class="btn small" data-gh="connect">Connect</button>' +
      (settings.token ? '<button type="button" class="btn ghost small" data-gh="forget">Forget token on this device</button>' : "") + "</div>" +
      (panelMsg ? '<p class="note" aria-live="polite">' + esc(panelMsg) + "</p>" : "") +
      "</div></details>";
    var q = function (id) { return el.querySelector("#" + id); };
    el.onclick = function (ev) {
      var b = ev.target.closest("[data-gh]");
      if (!b) return;
      ev.stopPropagation();
      if (b.dataset.gh === "forget") {
        settings.token = ""; settings.ok = false; store(settings);
        panelMsg = "Token removed from this device.";
        mountPanel(el, onChange); if (onChange) onChange();
        return;
      }
      settings.owner = q("gh-owner").value.trim();
      settings.repo = q("gh-repo").value.trim();
      settings.branch = q("gh-branch").value.trim() || "main";
      settings.token = q("gh-token").value.trim();
      settings.ok = false;
      if (!settings.owner || !settings.repo || !settings.token) {
        panelMsg = "Fill in all four boxes, then press Connect.";
        mountPanel(el, onChange); return;
      }
      b.disabled = true; b.textContent = "Checking…";
      req("GET", "/repos/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repo)).then(function (j) {
        if (j && j.permissions && j.permissions.push === false) { var e = new Error("read only"); e.code = "no_permission"; throw e; }
        settings.ok = true;
        if (!store(settings)) panelMsg = "Connected, but this browser can’t remember it. You’ll need to connect again next time.";
        else panelMsg = "Connected. Saving now goes straight to GitHub.";
        mountPanel(el, onChange); if (onChange) onChange();
      }).catch(function (e) {
        store(settings);
        panelMsg = explain(e);
        mountPanel(el, onChange); if (onChange) onChange();
      });
    };
  }

  window.CBHLGitHub = {
    ready: ready,
    settings: function () { return { owner: settings.owner, repo: settings.repo, branch: settings.branch }; },
    getFile: getFile, getSha: getSha, putText: putText, putB64: putB64,
    photoB64: photoB64, explain: explain, mountPanel: mountPanel
  };
})();
