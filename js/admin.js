(function () {
  var TOKEN_KEY = "PF_GH_TOKEN";
  var SESSION_KEY = "PF_ADMIN_SESSION";
  var PASS_KEY = "PF_ADMIN_K";
  var LOCK_URL = "admin-lock.json";
  var SECRET_URL = "admin-secret.json";
  var REPO_DEFAULT = "ElenaSamanchuk/popovichfit-tariffs";
  var BRANCH = "main";
  var REMEMBER_MS = 7 * 24 * 60 * 60 * 1000;
  var PBKDF2_ITER = 210000;
  var COURSES = {
    korrekciya: {
      id: "korrekciya",
      title: "Коррекция",
      config: "config-korrekciya.json",
      page: "korrekciya.html",
      draft: "PF_ADMIN_DRAFT_korrekciya",
      alsoSave: []
    },
    silovye: {
      id: "silovye",
      title: "Силовые",
      config: "config-silovye.json",
      page: "silovye.html",
      draft: "PF_ADMIN_DRAFT_silovye",
      alsoSave: ["config.json"]
    }
  };

  var course = resolveCourse();
  var config = null;
  var preview = document.getElementById("preview");
  var statusEl = document.getElementById("status");
  var formRoot = document.getElementById("form-root");
  var secretConfigured = false;
  var changeKeyOpen = false;
  var secretIssue = "";
  var adminStarted = false;

  function resolveCourse() {
    var params = new URLSearchParams(location.search);
    var id = document.documentElement.dataset.course || params.get("course") || "korrekciya";
    if (id === "silovoj") id = "silovye";
    if (!COURSES[id]) id = "korrekciya";
    return COURSES[id];
  }

  function setStatus(text, kind) {
    if (!statusEl) return;
    statusEl.textContent = text || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function setLoginStatus(text, kind) {
    var el = document.getElementById("login-status");
    if (!el) return;
    el.textContent = text || "";
    el.className = "status" + (kind ? " " + kind : "");
  }

  function token() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || "";
  }

  function currentPassword() {
    return sessionStorage.getItem(PASS_KEY) || localStorage.getItem(PASS_KEY) || "";
  }

  function repoName() {
    var el = document.getElementById("repo");
    return (el && el.value.trim()) || REPO_DEFAULT;
  }

  function sha256Hex(str) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  function hashesEqual(a, b) {
    a = String(a || "").toLowerCase();
    b = String(b || "").toLowerCase();
    if (!a || !b || a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function bufToB64(buf) {
    var bytes = new Uint8Array(buf);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function deriveAesKey(password, salt, iter) {
    return crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    ).then(function (material) {
      return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: iter, hash: "SHA-256" },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
      );
    });
  }

  function encryptPat(password, pat) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveAesKey(password, salt, PBKDF2_ITER).then(function (key) {
      return crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        new TextEncoder().encode(pat)
      );
    }).then(function (ct) {
      return {
        v: 1,
        kdf: "PBKDF2",
        hash: "SHA-256",
        iter: PBKDF2_ITER,
        salt: bufToB64(salt),
        iv: bufToB64(iv),
        ct: bufToB64(ct)
      };
    });
  }

  function decryptPat(password, secret) {
    var salt = b64ToBytes(secret.salt);
    var iv = b64ToBytes(secret.iv);
    var ct = b64ToBytes(secret.ct);
    return deriveAesKey(password, salt, secret.iter || PBKDF2_ITER).then(function (key) {
      return crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
    }).then(function (pt) {
      return new TextDecoder().decode(pt);
    });
  }

  function fetchJson(path) {
    return fetch(path + "?t=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(path + ": " + res.status);
      return res.json();
    });
  }

  function clearAuth() {
    [sessionStorage, localStorage].forEach(function (store) {
      store.removeItem(SESSION_KEY);
      store.removeItem(PASS_KEY);
      store.removeItem(TOKEN_KEY);
    });
  }

  function writeAuth(remember, login, password, pat) {
    var session = {
      v: 1,
      login: login,
      remember: !!remember,
      exp: remember ? Date.now() + REMEMBER_MS : 0
    };
    var raw = JSON.stringify(session);
    sessionStorage.setItem(SESSION_KEY, raw);
    sessionStorage.setItem(PASS_KEY, password);
    if (pat) sessionStorage.setItem(TOKEN_KEY, pat);
    else sessionStorage.removeItem(TOKEN_KEY);
    if (remember) {
      localStorage.setItem(SESSION_KEY, raw);
      localStorage.setItem(PASS_KEY, password);
      if (pat) localStorage.setItem(TOKEN_KEY, pat);
      else localStorage.removeItem(TOKEN_KEY);
    } else {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PASS_KEY);
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function cacheToken(pat) {
    sessionStorage.setItem(TOKEN_KEY, pat);
    var session = readSession();
    if (session && session.remember) localStorage.setItem(TOKEN_KEY, pat);
  }

  function readSession() {
    var raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      var session = JSON.parse(raw);
      if (session.remember && session.exp && Date.now() > session.exp) {
        clearAuth();
        return null;
      }
      if (!sessionStorage.getItem(SESSION_KEY) && session.remember) {
        sessionStorage.setItem(SESSION_KEY, raw);
        var password = localStorage.getItem(PASS_KEY);
        var pat = localStorage.getItem(TOKEN_KEY);
        if (password) sessionStorage.setItem(PASS_KEY, password);
        if (pat) sessionStorage.setItem(TOKEN_KEY, pat);
      }
      return session;
    } catch (e) {
      return null;
    }
  }

  function verifyCredentials(login, password, lock) {
    return sha256Hex(login + ":" + password).then(function (hex) {
      return hashesEqual(hex, lock.hash);
    });
  }

  function updateGithubUi() {
    var setup = document.getElementById("github-setup");
    var changeWrap = document.getElementById("change-key-wrap");
    var cancel = document.getElementById("cancel-key");
    if (setup) setup.hidden = !(!secretConfigured || changeKeyOpen);
    if (changeWrap) changeWrap.hidden = !secretConfigured || changeKeyOpen;
    if (cancel) cancel.hidden = !secretConfigured || !changeKeyOpen;
  }

  function showGithubSetup() {
    changeKeyOpen = true;
    updateGithubUi();
    var setup = document.getElementById("github-setup");
    if (setup) setup.scrollIntoView({ block: "nearest" });
  }

  function loadSecret(password) {
    return fetchJson(SECRET_URL).then(function (secret) {
      if (!secret || !secret.ct) {
        secretConfigured = false;
        secretIssue = "missing";
        updateGithubUi();
        return { ok: false, reason: "missing" };
      }
      return decryptPat(password, secret).then(function (pat) {
        cacheToken(pat);
        secretConfigured = true;
        secretIssue = "";
        changeKeyOpen = false;
        updateGithubUi();
        return { ok: true };
      }).catch(function () {
        secretConfigured = true;
        secretIssue = "decrypt";
        changeKeyOpen = true;
        updateGithubUi();
        return { ok: false, reason: "decrypt" };
      });
    });
  }

  function applySecretStatus() {
    if (!formRoot) return;
    if (secretIssue === "decrypt") {
      setStatus("Неверный пароль для ключа или ключ повреждён. Владелец может нажать «Сменить ключ».", "err");
    } else if (secretIssue === "missing") {
      setStatus("Ключ не настроен. Владелец должен один раз вставить GitHub-токен после входа.", "err");
    }
  }

  function revealApp() {
    document.body.classList.remove("is-locked");
    var pass = document.getElementById("login-pass");
    if (pass) pass.value = "";
  }

  function bindLogout() {
    var btn = document.getElementById("logout");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "1";
    btn.addEventListener("click", function () {
      clearAuth();
      location.reload();
    });
  }

  function bindGithubSetup() {
    var saveBtn = document.getElementById("save-token");
    var changeBtn = document.getElementById("change-key");
    var cancelBtn = document.getElementById("cancel-key");
    if (saveBtn && !saveBtn.dataset.bound) {
      saveBtn.dataset.bound = "1";
      saveBtn.addEventListener("click", saveGithubKey);
    }
    if (changeBtn && !changeBtn.dataset.bound) {
      changeBtn.dataset.bound = "1";
      changeBtn.addEventListener("click", function () {
        showGithubSetup();
      });
    }
    if (cancelBtn && !cancelBtn.dataset.bound) {
      cancelBtn.dataset.bound = "1";
      cancelBtn.addEventListener("click", function () {
        changeKeyOpen = false;
        var input = document.getElementById("token");
        if (input) input.value = "";
        updateGithubUi();
      });
    }
  }

  function afterUnlock() {
    bindLogout();
    bindGithubSetup();
    updateGithubUi();
    if (formRoot && !adminStarted) startAdmin();
  }

  function handleLogin(e) {
    e.preventDefault();
    if (!crypto.subtle) {
      setLoginStatus("Откройте админку по https или через localhost — так работает вход.", "err");
      return;
    }
    var login = document.getElementById("login-user").value.trim();
    var password = document.getElementById("login-pass").value;
    var remember = document.getElementById("login-remember").checked;
    setLoginStatus("Проверяю…");
    fetchJson(LOCK_URL).then(function (lock) {
      if (!lock || !lock.hash) throw new Error("нет admin-lock.json");
      return verifyCredentials(login, password, lock).then(function (ok) {
        if (!ok) {
          setLoginStatus("Неверный логин или пароль.", "err");
          return null;
        }
        writeAuth(remember, login, password, "");
        return loadSecret(password).then(function () {
          revealApp();
          afterUnlock();
        });
      });
    }).catch(function (err) {
      setLoginStatus("Не удалось проверить вход: " + err.message, "err");
    });
  }

  function tryRestore() {
    if (!crypto.subtle) return Promise.resolve(false);
    var session = readSession();
    var password = currentPassword();
    if (!session || !password) return Promise.resolve(false);
    return fetchJson(LOCK_URL).then(function (lock) {
      if (!lock || !lock.hash) return false;
      var login = session.login || lock.login || "";
      return verifyCredentials(login, password, lock).then(function (ok) {
        if (!ok) {
          clearAuth();
          return false;
        }
        return loadSecret(password).then(function () {
          revealApp();
          afterUnlock();
          return true;
        });
      });
    }).catch(function () {
      return false;
    });
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function ensureShape(cfg) {
    cfg = cfg || {};
    cfg.meta = cfg.meta || {};
    cfg.header = cfg.header || {};
    cfg.plashka = cfg.plashka || {};
    if (!Array.isArray(cfg.plashka.features)) cfg.plashka.features = [];
    if (!Array.isArray(cfg.cards)) cfg.cards = [];
    cfg.cards.forEach(function (card) {
      if (!Array.isArray(card.options)) card.options = [];
    });
    cfg.popup = cfg.popup || {};
    if (!Array.isArray(cfg.popup.howItems)) cfg.popup.howItems = [];
    if (!Array.isArray(cfg.popup.failItems)) cfg.popup.failItems = [];
    if (!Array.isArray(cfg.popup.plans)) cfg.popup.plans = [];
    if (cfg.renewalTitle == null) cfg.renewalTitle = "";
    return cfg;
  }

  function previewUrl() {
    return course.page + "?preview=1&t=" + Date.now();
  }

  function persistDraft() {
    localStorage.setItem(course.draft, JSON.stringify(config));
    if (preview && preview.contentWindow) {
      preview.contentWindow.postMessage({ type: "pf-config", config: config }, "*");
    }
  }

  function field(label, value, onChange, extra) {
    extra = extra || {};
    var wrap = document.createElement("div");
    if (extra.half) wrap.className = "field-half";
    var lab = document.createElement("label");
    lab.textContent = label;
    var input = extra.multiline ? document.createElement("textarea") : document.createElement("input");
    if (!extra.multiline) input.type = extra.type || "text";
    input.value = value == null ? "" : value;
    input.addEventListener("input", function () {
      onChange(input.value);
      persistDraft();
    });
    wrap.appendChild(lab);
    wrap.appendChild(input);
    return wrap;
  }

  function checkbox(label, checked, onChange) {
    var wrap = document.createElement("label");
    wrap.className = "check";
    var input = document.createElement("input");
    input.type = "checkbox";
    input.checked = !!checked;
    input.addEventListener("change", function () {
      onChange(input.checked);
      persistDraft();
    });
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }

  function selectField(label, value, options, onChange) {
    var wrap = document.createElement("div");
    var lab = document.createElement("label");
    lab.textContent = label;
    var sel = document.createElement("select");
    options.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = String(opt.value);
      o.textContent = opt.label;
      if (String(opt.value) === String(value)) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      onChange(sel.value);
      persistDraft();
    });
    wrap.appendChild(lab);
    wrap.appendChild(sel);
    return wrap;
  }

  function section(title) {
    var el = document.createElement("section");
    el.className = "card";
    var h = document.createElement("h2");
    h.textContent = title;
    el.appendChild(h);
    return el;
  }

  function grid() {
    var el = document.createElement("div");
    el.className = "grid2";
    return el;
  }

  function listEditor(title, items) {
    var box = document.createElement("div");
    box.className = "list-editor";
    var lab = document.createElement("label");
    lab.textContent = title;
    box.appendChild(lab);
    var rows = document.createElement("div");
    box.appendChild(rows);

    function addRow(index) {
      var row = document.createElement("div");
      row.className = "list-row";
      var input = document.createElement("input");
      input.type = "text";
      input.value = items[index] == null ? "" : items[index];
      input.addEventListener("input", function () {
        items[index] = input.value;
        persistDraft();
      });
      var del = document.createElement("button");
      del.type = "button";
      del.className = "btn btn--ghost btn--icon";
      del.setAttribute("aria-label", "Удалить пункт");
      del.textContent = "×";
      del.addEventListener("click", function () {
        items.splice(index, 1);
        persistDraft();
        rebuild();
      });
      row.appendChild(input);
      row.appendChild(del);
      rows.appendChild(row);
    }

    function rebuild() {
      rows.innerHTML = "";
      items.forEach(function (_, i) { addRow(i); });
    }

    rebuild();

    var add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn--ghost btn--small";
    add.textContent = "Добавить пункт";
    add.addEventListener("click", function () {
      items.push("");
      persistDraft();
      rebuild();
    });
    box.appendChild(add);
    return box;
  }

  function renderForm() {
    formRoot.innerHTML = "";

    var h = section("Шапка курса");
    h.appendChild(field("Заголовок", config.header.title, function (v) { config.header.title = v; }));
    h.appendChild(field("Подзаголовок", config.header.subtitle, function (v) { config.header.subtitle = v; }, { multiline: true }));
    var hg = grid();
    hg.appendChild(field("Старт потока", config.header.startLabel, function (v) { config.header.startLabel = v; }));
    hg.appendChild(field("Длительность", config.header.durationLabel, function (v) { config.header.durationLabel = v; }));
    h.appendChild(hg);
    formRoot.appendChild(h);

    var p = section("Плашка подписки");
    p.appendChild(checkbox("Показывать плашку", config.plashka.visible !== false, function (v) { config.plashka.visible = v; }));
    p.appendChild(field("Надпись над плашкой", config.plashka.eyebrow, function (v) { config.plashka.eyebrow = v; }));
    p.appendChild(field("Заголовок", config.plashka.title, function (v) { config.plashka.title = v; }));
    p.appendChild(field("Текст", config.plashka.text, function (v) { config.plashka.text = v; }, { multiline: true }));
    var pg = grid();
    pg.appendChild(field("Бейдж NEW", config.plashka.newBadge, function (v) { config.plashka.newBadge = v; }));
    pg.appendChild(field("Салатовый бейдж", config.plashka.limeBadge, function (v) { config.plashka.limeBadge = v; }));
    p.appendChild(pg);
    var pp = grid();
    pp.appendChild(field("Цена «от»", config.plashka.priceFrom, function (v) { config.plashka.priceFrom = v; }));
    pp.appendChild(field("Вместо разовой", config.plashka.priceInstead, function (v) { config.plashka.priceInstead = v; }));
    p.appendChild(pp);
    p.appendChild(field("Кнопка", config.plashka.cta, function (v) { config.plashka.cta = v; }));
    p.appendChild(field("Картинка (ссылка или assets/…)", config.plashka.image, function (v) { config.plashka.image = v; }));
    p.appendChild(listEditor("Преимущества", config.plashka.features));
    formRoot.appendChild(p);

    var rt = section("Заголовок над карточками");
    rt.appendChild(field("Текст", config.renewalTitle, function (v) { config.renewalTitle = v; }));
    formRoot.appendChild(rt);

    config.cards.forEach(function (card, ci) {
      var box = section("Карточка " + (ci + 1) + ": " + (card.title || "без названия"));
      box.appendChild(checkbox("Показывать карточку", card.visible !== false, function (v) { card.visible = v; }));
      box.appendChild(field("Название", card.title, function (v) { card.title = v; }));
      box.appendChild(field("Описание", card.description, function (v) { card.description = v; }, { multiline: true }));
      var bg = grid();
      bg.appendChild(field("Бейдж скидки", card.discountBadge, function (v) { card.discountBadge = v; }));
      bg.appendChild(field("Скидка до", card.discountUntil, function (v) { card.discountUntil = v; }));
      box.appendChild(bg);
      box.appendChild(field("Места", card.spotsLabel, function (v) { card.spotsLabel = v; }));
      box.appendChild(checkbox("Места ограничены (розовый бейдж)", card.spotsLimited, function (v) { card.spotsLimited = v; }));
      box.appendChild(field("Доп. бейдж", card.extraBadge, function (v) { card.extraBadge = v; }));
      var pr = grid();
      pr.appendChild(field("Подпись цены", card.priceLabel, function (v) { card.priceLabel = v; }));
      box.appendChild(pr);
      box.appendChild(field("Кнопка покупки", card.buyLabel, function (v) { card.buyLabel = v; }));
      if (card.options && card.options.length) {
        box.appendChild(selectField(
          "Какая опция выбрана сначала",
          card.defaultOption || 0,
          card.options.map(function (opt, i) {
            return { value: i, label: opt.label || ("Опция " + (i + 1)) };
          }),
          function (v) { card.defaultOption = Number(v) || 0; }
        ));
      }
      (card.options || []).forEach(function (opt, oi) {
        var o = document.createElement("div");
        o.className = "opt";
        var oh = document.createElement("h3");
        oh.textContent = "Вариант " + (oi + 1) + (opt.label ? " — " + opt.label : "");
        o.appendChild(oh);
        o.appendChild(field("Название", opt.label, function (v) { opt.label = v; }));
        var og = grid();
        og.appendChild(field("Новая цена", opt.newPrice, function (v) { opt.newPrice = v; }));
        og.appendChild(field("Старая цена", opt.oldPrice, function (v) { opt.oldPrice = v; }));
        o.appendChild(og);
        o.appendChild(field("Ссылка оплаты", opt.link, function (v) { opt.link = v; }, { type: "url" }));
        o.appendChild(selectField(
          "Что делает кнопка «купить»",
          opt.action || "pay",
          [
            { value: "pay", label: "Открыть ссылку оплаты" },
            { value: "popup", label: "Открыть попап подписки" }
          ],
          function (v) { opt.action = v; }
        ));
        var og2 = grid();
        og2.appendChild(field("Текст «выбрать»", opt.selectLabel || "", function (v) { opt.selectLabel = v; }));
        og2.appendChild(field("Бейдж варианта", opt.badge || "", function (v) { opt.badge = v; }));
        o.appendChild(og2);
        box.appendChild(o);
      });
      formRoot.appendChild(box);
    });

    var pop = section("Попап подписки");
    var popup = config.popup;
    pop.appendChild(field("Заголовок", popup.title, function (v) { popup.title = v; }));
    pop.appendChild(field("Лид 1", popup.lead, function (v) { popup.lead = v; }, { multiline: true }));
    pop.appendChild(field("Лид 2", popup.lead2, function (v) { popup.lead2 = v; }));
    var pg2 = grid();
    pg2.appendChild(field("«Выберите тариф»", popup.chooseLabel, function (v) { popup.chooseLabel = v; }));
    pg2.appendChild(field("Подпись плана", popup.planCaption, function (v) { popup.planCaption = v; }));
    pop.appendChild(pg2);
    var pg3 = grid();
    pg3.appendChild(field("Разовое продление", popup.oneTimeLabel, function (v) { popup.oneTimeLabel = v; }));
    pg3.appendChild(field("Стоимость с подпиской", popup.subPriceLabel, function (v) { popup.subPriceLabel = v; }));
    pop.appendChild(pg3);
    pop.appendChild(field("Заголовок «как это работает»", popup.howTitle, function (v) { popup.howTitle = v; }));
    pop.appendChild(listEditor("Как это работает", popup.howItems));
    pop.appendChild(field("Заголовок «если платёж не прошёл»", popup.failTitle, function (v) { popup.failTitle = v; }));
    pop.appendChild(listEditor("Если платёж не прошёл", popup.failItems));
    pop.appendChild(field("Текст про поддержку", popup.failSupportPrefix, function (v) { popup.failSupportPrefix = v; }));
    pop.appendChild(field("Заметка про карты РФ", popup.rfNote, function (v) { popup.rfNote = v; }));
    pop.appendChild(field("Кнопка попапа", popup.cta, function (v) { popup.cta = v; }));
    if (popup.plans && popup.plans.length) {
      pop.appendChild(selectField(
        "Какой план выбран сначала",
        popup.defaultPlan || 0,
        popup.plans.map(function (plan, i) {
          return { value: i, label: plan.title || ("План " + (i + 1)) };
        }),
        function (v) { popup.defaultPlan = Number(v) || 0; }
      ));
    }
    (popup.plans || []).forEach(function (plan, i) {
      var o = document.createElement("div");
      o.className = "opt";
      var oh = document.createElement("h3");
      oh.textContent = "План подписки " + (i + 1) + (plan.title ? " — " + plan.title : "");
      o.appendChild(oh);
      o.appendChild(field("Название", plan.title, function (v) { plan.title = v; }));
      var g = grid();
      g.appendChild(field("Разовая цена", plan.oneTimePrice, function (v) { plan.oneTimePrice = v; }));
      g.appendChild(field("Цена подписки", plan.subPrice, function (v) { plan.subPrice = v; }));
      o.appendChild(g);
      o.appendChild(field("Ссылка оплаты подписки", plan.link, function (v) { plan.link = v; }, { type: "url" }));
      pop.appendChild(o);
    });
    formRoot.appendChild(pop);

    var meta = section("Поддержка");
    meta.appendChild(field("Ссылка поддержки", config.meta.supportUrl, function (v) { config.meta.supportUrl = v; }, { type: "url" }));
    meta.appendChild(field("Текст ссылки поддержки", config.meta.supportText, function (v) { config.meta.supportText = v; }));
    formRoot.appendChild(meta);

    var adv = document.createElement("details");
    adv.className = "dev-only";
    var sum = document.createElement("summary");
    sum.textContent = "Для разработчика";
    var hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Сырой JSON. Обычному редактору не нужен — все поля выше.";
    var ta = document.createElement("textarea");
    ta.className = "dev-json";
    ta.value = JSON.stringify(config, null, 2);
    ta.addEventListener("change", function () {
      try {
        config = ensureShape(JSON.parse(ta.value));
        persistDraft();
        renderForm();
        setStatus("Технический JSON применён в превью. Чтобы опубликовать, нажмите «Сохранить».", "ok");
      } catch (err) {
        setStatus("Ошибка JSON: " + err.message, "err");
      }
    });
    adv.appendChild(sum);
    adv.appendChild(hint);
    adv.appendChild(ta);
    formRoot.appendChild(adv);
  }

  function utf8ToB64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function githubHeaders(pat) {
    return {
      Authorization: "Bearer " + (pat || token()),
      Accept: "application/vnd.github+json"
    };
  }

  function githubGetSha(repo, path, pat) {
    return fetch("https://api.github.com/repos/" + repo + "/contents/" + path + "?ref=" + BRANCH, {
      headers: githubHeaders(pat)
    }).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) {
        return res.text().then(function (text) {
          throw new Error("GET " + path + ": " + res.status + " " + text);
        });
      }
      return res.json().then(function (data) { return data.sha; });
    });
  }

  function githubPut(repo, path, content, message, sha, pat) {
    var body = { message: message, content: utf8ToB64(content), branch: BRANCH };
    if (sha) body.sha = sha;
    var headers = githubHeaders(pat);
    headers["Content-Type"] = "application/json";
    return fetch("https://api.github.com/repos/" + repo + "/contents/" + path, {
      method: "PUT",
      headers: headers,
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (text) {
          throw new Error("PUT " + path + ": " + res.status + " " + text);
        });
      }
      return res.json();
    });
  }

  function putFile(repo, path, content, message, pat) {
    return githubGetSha(repo, path, pat).then(function (sha) {
      return githubPut(repo, path, content, message, sha, pat);
    });
  }

  function needOwnerToken() {
    showGithubSetup();
    setStatus("Владелец должен один раз вставить GitHub-токен после входа.", "err");
  }

  function saveConfig() {
    var t = token();
    if (!t) {
      needOwnerToken();
      return;
    }
    var json = JSON.stringify(config, null, 2) + "\n";
    var repo = repoName();
    setStatus("Сохраняю на сайт…");
    putFile(repo, course.config, json, "chore: update " + course.config, t).then(function () {
      var extras = course.alsoSave || [];
      var chain = Promise.resolve();
      extras.forEach(function (extra) {
        chain = chain.then(function () {
          return putFile(repo, extra, json, "chore: sync " + extra + " with " + course.config, t);
        });
      });
      return chain;
    }).then(function () {
      persistDraft();
      if (preview) preview.src = previewUrl();
      setStatus("Сохранено. Через минуту обновятся живая страница и iframe на Тильде.", "ok");
    }).catch(function (err) {
      showGithubSetup();
      setStatus("Не удалось сохранить: " + err.message, "err");
    });
  }

  function saveGithubKey() {
    var input = document.getElementById("token");
    var pat = input ? input.value.trim() : "";
    var password = currentPassword();
    if (!pat) {
      setStatus("Вставьте токен GitHub.", "err");
      return;
    }
    if (!password) {
      setStatus("Сессия истекла. Войдите снова.", "err");
      return;
    }
    setStatus("Шифрую и сохраняю ключ…");
    encryptPat(password, pat).then(function (payload) {
      var json = JSON.stringify(payload, null, 2) + "\n";
      return putFile(repoName(), SECRET_URL, json, "chore: update encrypted admin secret", pat);
    }).then(function () {
      cacheToken(pat);
      secretConfigured = true;
      secretIssue = "";
      changeKeyOpen = false;
      if (input) input.value = "";
      updateGithubUi();
      setStatus("Ключ сохранён. Дальше коллегам достаточно войти и нажать «Сохранить».", "ok");
    }).catch(function (err) {
      setStatus("Не удалось сохранить ключ: " + err.message, "err");
    });
  }

  function uploadImage(file) {
    var t = token();
    if (!t) {
      needOwnerToken();
      return;
    }
    var name = "assets/" + Date.now() + "-" + file.name.replace(/[^\w.\-]+/g, "_");
    file.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var bin = "";
      for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      var b64 = btoa(bin);
      setStatus("Загружаю картинку…");
      var headers = githubHeaders(t);
      headers["Content-Type"] = "application/json";
      return fetch("https://api.github.com/repos/" + repoName() + "/contents/" + name, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify({
          message: "chore: upload " + name,
          content: b64,
          branch: BRANCH
        })
      }).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (text) {
            throw new Error(text);
          });
        }
        config.plashka.image = name;
        persistDraft();
        renderForm();
        setStatus("Картинка загружена. Нажмите «Сохранить», чтобы она появилась на сайте.", "ok");
      });
    }).catch(function (err) {
      setStatus("Ошибка загрузки: " + err.message, "err");
    });
  }

  function boot(initial) {
    config = ensureShape(deepClone(initial));
    persistDraft();
    renderForm();
    if (preview && !preview.getAttribute("src")) preview.src = previewUrl();
    document.getElementById("save").addEventListener("click", saveConfig);
    document.getElementById("reload-preview").addEventListener("click", function () {
      persistDraft();
      preview.src = previewUrl();
    });
    document.getElementById("image-file").addEventListener("change", function (e) {
      if (e.target.files[0]) uploadImage(e.target.files[0]);
    });
    preview.addEventListener("load", function () {
      persistDraft();
    });
    if (secretIssue) applySecretStatus();
    else setStatus("Поля загружены. Превью справа обновляется при вводе. На сайт — только после «Сохранить».");
  }

  function startAdmin() {
    adminStarted = true;
    fetch(course.config + "?t=" + Date.now(), { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status + " " + r.statusText);
        return r.json();
      })
      .then(boot)
      .catch(function (err) {
        formRoot.innerHTML = "<p class=\"status err\">Не удалось загрузить поля. Обновите страницу.</p>";
        setStatus("Не удалось загрузить данные: " + err.message, "err");
      });
  }

  var loginForm = document.getElementById("login-form");
  if (loginForm) loginForm.addEventListener("submit", handleLogin);
  tryRestore();
})();
