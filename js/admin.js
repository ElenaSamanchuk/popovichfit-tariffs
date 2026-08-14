(function () {
  var TOKEN_KEY = "PF_GH_TOKEN";
  var DRAFT_KEY = "PF_ADMIN_DRAFT";
  var REPO_DEFAULT = "ElenaSamanchuk/popovichfit-tariffs";
  var PATH = "config.json";
  var BRANCH = "main";

  var config = null;
  var preview = document.getElementById("preview");
  var statusEl = document.getElementById("status");
  var formRoot = document.getElementById("form-root");

  function setStatus(text, kind) {
    statusEl.textContent = text || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  function token() {
    return localStorage.getItem(TOKEN_KEY) || document.getElementById("token").value.trim();
  }

  function repoName() {
    return document.getElementById("repo").value.trim() || REPO_DEFAULT;
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function persistDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
    if (preview && preview.contentWindow) {
      preview.contentWindow.postMessage({ type: "pf-config", config: config }, "*");
    }
  }

  function field(label, value, onChange, extra) {
    extra = extra || {};
    var wrap = document.createElement("div");
    var lab = document.createElement("label");
    lab.textContent = label;
    var input = extra.multiline ? document.createElement("textarea") : document.createElement("input");
    if (!extra.multiline) input.type = extra.type || "text";
    input.value = value == null ? "" : value;
    input.addEventListener("input", function () { onChange(input.value); persistDraft(); });
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
    input.addEventListener("change", function () { onChange(input.checked); persistDraft(); });
    wrap.appendChild(input);
    wrap.appendChild(document.createTextNode(label));
    return wrap;
  }

  function section(title) {
    var el = document.createElement("div");
    el.className = "card";
    var h = document.createElement("h2");
    h.textContent = title;
    el.appendChild(h);
    return el;
  }

  function listEditor(parent, arr, placeholder, renderItem) {
    arr.forEach(function (item, i) { parent.appendChild(renderItem(item, i, arr)); });
    var add = document.createElement("button");
    add.type = "button";
    add.className = "btn btn--ghost";
    add.textContent = "Добавить";
    add.addEventListener("click", function () {
      arr.push(typeof placeholder === "function" ? placeholder() : placeholder);
      persistDraft();
      renderForm();
    });
    parent.appendChild(add);
  }

  function renderForm() {
    formRoot.innerHTML = "";
    var h = section("Шапка курса");
    h.appendChild(field("Заголовок", config.header.title, function (v) { config.header.title = v; }));
    h.appendChild(field("Подзаголовок", config.header.subtitle, function (v) { config.header.subtitle = v; }, { multiline: true }));
    h.appendChild(field("Старт потока", config.header.startLabel, function (v) { config.header.startLabel = v; }));
    h.appendChild(field("Длительность", config.header.durationLabel, function (v) { config.header.durationLabel = v; }));
    formRoot.appendChild(h);

    var p = section("Плашка подписки");
    p.appendChild(checkbox("Показывать плашку", config.plashka.visible !== false, function (v) { config.plashka.visible = v; }));
    p.appendChild(field("Надпись над плашкой", config.plashka.eyebrow, function (v) { config.plashka.eyebrow = v; }));
    p.appendChild(field("Бейдж NEW", config.plashka.newBadge, function (v) { config.plashka.newBadge = v; }));
    p.appendChild(field("Заголовок", config.plashka.title, function (v) { config.plashka.title = v; }));
    p.appendChild(field("Текст", config.plashka.text, function (v) { config.plashka.text = v; }, { multiline: true }));
    p.appendChild(field("Цена «от»", config.plashka.priceFrom, function (v) { config.plashka.priceFrom = v; }));
    p.appendChild(field("Вместо разовой", config.plashka.priceInstead, function (v) { config.plashka.priceInstead = v; }));
    p.appendChild(field("Салатовый бейдж", config.plashka.limeBadge, function (v) { config.plashka.limeBadge = v; }));
    p.appendChild(field("Кнопка", config.plashka.cta, function (v) { config.plashka.cta = v; }));
    p.appendChild(field("Картинка (URL или assets/...)", config.plashka.image, function (v) { config.plashka.image = v; }));
    var featBox = document.createElement("div");
    featBox.innerHTML = "<label>Преимущества</label>";
    (config.plashka.features || []).forEach(function (f, i) {
      featBox.appendChild(field("Пункт " + (i + 1), f, function (v) { config.plashka.features[i] = v; }));
    });
    p.appendChild(featBox);
    formRoot.appendChild(p);

    formRoot.appendChild(field("Заголовок над карточками", config.renewalTitle, function (v) { config.renewalTitle = v; }));

    config.cards.forEach(function (card, ci) {
      var box = section("Карточка: " + (card.title || card.id));
      box.appendChild(checkbox("Показывать карточку", card.visible !== false, function (v) { card.visible = v; }));
      box.appendChild(field("ID", card.id, function (v) { card.id = v; }));
      box.appendChild(field("Название", card.title, function (v) { card.title = v; }));
      box.appendChild(field("Бейдж скидки", card.discountBadge, function (v) { card.discountBadge = v; }));
      box.appendChild(field("Места", card.spotsLabel, function (v) { card.spotsLabel = v; }));
      box.appendChild(checkbox("Места ограничены (розовый бейдж)", card.spotsLimited, function (v) { card.spotsLimited = v; }));
      box.appendChild(field("Доп. бейдж", card.extraBadge, function (v) { card.extraBadge = v; }));
      box.appendChild(field("Описание", card.description, function (v) { card.description = v; }, { multiline: true }));
      box.appendChild(field("Подпись цены", card.priceLabel, function (v) { card.priceLabel = v; }));
      box.appendChild(field("Скидка до", card.discountUntil, function (v) { card.discountUntil = v; }));
      box.appendChild(field("Кнопка покупки", card.buyLabel, function (v) { card.buyLabel = v; }));
      (card.options || []).forEach(function (opt, oi) {
        var o = document.createElement("div");
        o.className = "opt";
        o.innerHTML = "<h3>Опция " + (oi + 1) + "</h3>";
        o.appendChild(field("ID", opt.id, function (v) { opt.id = v; }));
        o.appendChild(field("Название", opt.label, function (v) { opt.label = v; }));
        o.appendChild(field("Новая цена", opt.newPrice, function (v) { opt.newPrice = v; }));
        o.appendChild(field("Старая цена", opt.oldPrice, function (v) { opt.oldPrice = v; }));
        o.appendChild(field("Ссылка оплаты", opt.link, function (v) { opt.link = v; }));
        o.appendChild(field("Действие (pay / popup)", opt.action, function (v) { opt.action = v; }));
        o.appendChild(field("Бейдж опции", opt.badge || "", function (v) { opt.badge = v; }));
        box.appendChild(o);
      });
      formRoot.appendChild(box);
    });

    var pop = section("Попап подписки");
    var popup = config.popup;
    pop.appendChild(field("Заголовок", popup.title, function (v) { popup.title = v; }));
    pop.appendChild(field("Лид 1", popup.lead, function (v) { popup.lead = v; }, { multiline: true }));
    pop.appendChild(field("Лид 2", popup.lead2, function (v) { popup.lead2 = v; }));
    pop.appendChild(field("Выберите тариф", popup.chooseLabel, function (v) { popup.chooseLabel = v; }));
    pop.appendChild(field("Подпись плана", popup.planCaption, function (v) { popup.planCaption = v; }));
    pop.appendChild(field("Разовое продление", popup.oneTimeLabel, function (v) { popup.oneTimeLabel = v; }));
    pop.appendChild(field("Стоимость с подпиской", popup.subPriceLabel, function (v) { popup.subPriceLabel = v; }));
    pop.appendChild(field("Как это работает", popup.howTitle, function (v) { popup.howTitle = v; }));
    (popup.howItems || []).forEach(function (item, i) {
      pop.appendChild(field("Как " + (i + 1), item, function (v) { popup.howItems[i] = v; }));
    });
    pop.appendChild(field("Если платёж не прошёл", popup.failTitle, function (v) { popup.failTitle = v; }));
    (popup.failItems || []).forEach(function (item, i) {
      pop.appendChild(field("Не прошёл " + (i + 1), item, function (v) { popup.failItems[i] = v; }));
    });
    pop.appendChild(field("Текст про поддержку", popup.failSupportPrefix, function (v) { popup.failSupportPrefix = v; }));
    pop.appendChild(field("Заметка про карты РФ", popup.rfNote, function (v) { popup.rfNote = v; }));
    pop.appendChild(field("Кнопка попапа", popup.cta, function (v) { popup.cta = v; }));
    (popup.plans || []).forEach(function (plan, i) {
      var o = document.createElement("div");
      o.className = "opt";
      o.innerHTML = "<h3>План подписки " + (i + 1) + "</h3>";
      o.appendChild(field("Название", plan.title, function (v) { plan.title = v; }));
      o.appendChild(field("Разовая цена", plan.oneTimePrice, function (v) { plan.oneTimePrice = v; }));
      o.appendChild(field("Цена подписки", plan.subPrice, function (v) { plan.subPrice = v; }));
      o.appendChild(field("Бейдж скидки", plan.discountBadge, function (v) { plan.discountBadge = v; }));
      o.appendChild(field("Ссылка оплаты подписки", plan.link, function (v) { plan.link = v; }));
      pop.appendChild(o);
    });
    formRoot.appendChild(pop);

    var meta = section("Служебное");
    meta.appendChild(field("Ссылка поддержки", config.meta.supportUrl, function (v) { config.meta.supportUrl = v; }));
    meta.appendChild(field("Текст ссылки поддержки", config.meta.supportText, function (v) { config.meta.supportText = v; }));
    formRoot.appendChild(meta);

    var adv = document.createElement("details");
    var sum = document.createElement("summary");
    sum.textContent = "Расширенный JSON";
    var ta = document.createElement("textarea");
    ta.style.minHeight = "240px";
    ta.value = JSON.stringify(config, null, 2);
    ta.addEventListener("change", function () {
      try {
        config = JSON.parse(ta.value);
        persistDraft();
        renderForm();
        setStatus("JSON применён", "ok");
      } catch (e) {
        setStatus("Ошибка JSON: " + e.message, "err");
      }
    });
    adv.appendChild(sum);
    adv.appendChild(ta);
    formRoot.appendChild(adv);
  }

  function utf8ToB64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  async function githubGetSha(repo, path) {
    var res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path + "?ref=" + BRANCH, {
      headers: { Authorization: "Bearer " + token(), Accept: "application/vnd.github+json" }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("GET " + path + ": " + res.status + " " + await res.text());
    var data = await res.json();
    return data.sha;
  }

  async function githubPut(repo, path, content, message, sha) {
    var body = { message: message, content: utf8ToB64(content), branch: BRANCH };
    if (sha) body.sha = sha;
    var res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token(),
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("PUT " + path + ": " + res.status + " " + await res.text());
    return res.json();
  }

  async function saveConfig() {
    var t = token();
    if (!t) {
      setStatus("Вставьте GitHub PAT с правом repo", "err");
      return;
    }
    localStorage.setItem(TOKEN_KEY, t);
    setStatus("Сохраняю config.json…");
    try {
      var repo = repoName();
      var sha = await githubGetSha(repo, PATH);
      await githubPut(repo, PATH, JSON.stringify(config, null, 2) + "\n", "chore: update tariffs config", sha);
      setStatus("Сохранено. Страница тарифов обновится через несколько секунд.", "ok");
      persistDraft();
      if (preview) preview.src = "index.html?preview=1&t=" + Date.now();
    } catch (e) {
      setStatus(e.message, "err");
    }
  }

  async function uploadImage(file) {
    var t = token();
    if (!t) {
      setStatus("Для загрузки картинки нужен PAT", "err");
      return;
    }
    var name = "assets/" + Date.now() + "-" + file.name.replace(/[^\w.\-]+/g, "_");
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = btoa(bin);
    setStatus("Загружаю " + name + "…");
    try {
      var repo = repoName();
      var res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + name, {
        method: "PUT",
        headers: {
          Authorization: "Bearer " + t,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "chore: upload " + name,
          content: b64,
          branch: BRANCH
        })
      });
      if (!res.ok) throw new Error(await res.text());
      config.plashka.image = name;
      persistDraft();
      renderForm();
      setStatus("Картинка загружена: " + name, "ok");
    } catch (e) {
      setStatus("Ошибка загрузки: " + e.message, "err");
    }
  }

  function boot(initial) {
    config = deepClone(initial);
    persistDraft();
    renderForm();
    document.getElementById("token").value = localStorage.getItem(TOKEN_KEY) || "";
    document.getElementById("repo").value = REPO_DEFAULT;
    document.getElementById("save").addEventListener("click", saveConfig);
    document.getElementById("reload-preview").addEventListener("click", function () {
      persistDraft();
      preview.src = "index.html?preview=1&t=" + Date.now();
    });
    document.getElementById("image-file").addEventListener("change", function (e) {
      if (e.target.files[0]) uploadImage(e.target.files[0]);
    });
    preview.addEventListener("load", function () {
      persistDraft();
    });
  }

  fetch("config.json?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(boot)
    .catch(function (e) {
      setStatus("Не удалось загрузить config.json: " + e.message, "err");
    });
})();
