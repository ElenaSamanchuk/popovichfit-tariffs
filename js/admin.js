(function () {
  var TOKEN_KEY = "PF_GH_TOKEN";
  var REPO_DEFAULT = "ElenaSamanchuk/popovichfit-tariffs";
  var BRANCH = "main";
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

  function resolveCourse() {
    var params = new URLSearchParams(location.search);
    var id = document.documentElement.dataset.course || params.get("course") || "korrekciya";
    if (id === "silovoj") id = "silovye";
    if (!COURSES[id]) id = "korrekciya";
    return COURSES[id];
  }

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
      pr.appendChild(field("Подпись цены на телефоне", card.priceLabelMobile || "", function (v) { card.priceLabelMobile = v; }));
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
      o.appendChild(field("Бейдж скидки", plan.discountBadge, function (v) { plan.discountBadge = v; }));
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
      } catch (e) {
        setStatus("Ошибка JSON: " + e.message, "err");
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

  async function putFile(repo, path, content, message) {
    var sha = await githubGetSha(repo, path);
    return githubPut(repo, path, content, message, sha);
  }

  function openPublish() {
    var pub = document.getElementById("publish-settings");
    if (pub) pub.open = true;
  }

  async function saveConfig() {
    var t = token();
    if (!t) {
      openPublish();
      setStatus("Откройте «Доступ к GitHub», вставьте токен с правом repo и нажмите «Сохранить» ещё раз.", "err");
      return;
    }
    localStorage.setItem(TOKEN_KEY, t);
    var json = JSON.stringify(config, null, 2) + "\n";
    var repo = repoName();
    var paths = [course.config].concat(course.alsoSave || []);
    setStatus("Сохраняю на сайт…");
    try {
      await putFile(repo, course.config, json, "chore: update " + course.config);
      for (var i = 0; i < (course.alsoSave || []).length; i++) {
        var extra = course.alsoSave[i];
        await putFile(repo, extra, json, "chore: sync " + extra + " with " + course.config);
      }
      persistDraft();
      if (preview) preview.src = previewUrl();
      setStatus("Сохранено. Через минуту обновятся живая страница и iframe на Тильде.", "ok");
    } catch (e) {
      openPublish();
      setStatus("Не удалось сохранить: " + e.message, "err");
    }
  }

  async function uploadImage(file) {
    var t = token();
    if (!t) {
      openPublish();
      setStatus("Для загрузки картинки нужен токен в блоке «Доступ к GitHub».", "err");
      return;
    }
    var name = "assets/" + Date.now() + "-" + file.name.replace(/[^\w.\-]+/g, "_");
    var buf = await file.arrayBuffer();
    var bytes = new Uint8Array(buf);
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var b64 = btoa(bin);
    setStatus("Загружаю картинку…");
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
      setStatus("Картинка загружена. Нажмите «Сохранить», чтобы она появилась на сайте.", "ok");
    } catch (e) {
      setStatus("Ошибка загрузки: " + e.message, "err");
    }
  }

  function boot(initial) {
    config = ensureShape(deepClone(initial));
    persistDraft();
    renderForm();
    document.getElementById("token").value = localStorage.getItem(TOKEN_KEY) || "";
    document.getElementById("repo").value = REPO_DEFAULT;
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
    setStatus("Поля загружены. Превью справа обновляется при вводе. На сайт — только после «Сохранить».");
  }

  fetch(course.config + "?t=" + Date.now(), { cache: "no-store" })
    .then(function (r) {
      if (!r.ok) throw new Error(r.status + " " + r.statusText);
      return r.json();
    })
    .then(boot)
    .catch(function (e) {
      formRoot.innerHTML = "<p class=\"status err\">Не удалось загрузить поля. Обновите страницу.</p>";
      setStatus("Не удалось загрузить данные: " + e.message, "err");
    });
})();
