(function () {
  var RESIZE_TYPE = "popovich-tariffs-resize";
  var MODAL_TYPE = "popovich-tariffs-modal";
  var VIEWPORT_TYPE = "popovich-tariffs-viewport";
  var PING_TYPE = "popovich-tariffs-ping";
  var CLOSE_TYPE = "popovich-tariffs-modal-close";
  var CLOSING_TYPE = "popovich-tariffs-modal-closing";
  var CONFIG_TYPE = "pf-config";

  var state = {
    config: null,
    selected: {},
    popupPlan: 0,
    popupOpen: false,
    popupLeaving: false
  };
  var inIframe = window.parent && window.parent !== window;
  var leaveMs = 300;
  var lastHeight = 0;
  var heightRaf = 0;
  var contentRO = null;

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function visibleCards(cfg) {
    return (cfg.cards || []).filter(function (c) { return c.visible !== false; });
  }

  function optionById(card, id) {
    return (card.options || []).find(function (o) { return o.id === id; }) || card.options[0];
  }

  function postToParent(payload) {
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage(payload, "*"); } catch (e) {}
    }
  }

  function measure() {
    var doc = document.documentElement;
    var body = document.body;
    if (!body) return 0;
    var widget = $(".pf-widget");
    var root = $("#pf-root");
    var scrollY = window.scrollY || doc.scrollTop || 0;
    var values = [
      body.scrollHeight,
      body.offsetHeight,
      doc.scrollHeight,
      doc.offsetHeight
    ];
    function addBox(el) {
      if (!el) return;
      var rect = el.getBoundingClientRect();
      values.push(
        el.scrollHeight,
        el.offsetHeight,
        Math.ceil(rect.height),
        Math.ceil(rect.bottom + scrollY)
      );
    }
    addBox(root);
    addBox(widget);
    return Math.ceil(Math.max.apply(Math, values));
  }

  function sendHeight() {
    heightRaf = 0;
    if (state.popupOpen || state.popupLeaving) return;
    var height = measure();
    if (!height || height < 100) return;
    if (Math.abs(height - lastHeight) < 2) return;
    lastHeight = height;
    postToParent({ type: RESIZE_TYPE, height: height });
  }

  function scheduleHeight() {
    if (heightRaf) return;
    heightRaf = requestAnimationFrame(sendHeight);
  }

  function watchImages() {
    document.querySelectorAll(".pf-widget img").forEach(function (img) {
      if (img.complete) return;
      img.addEventListener("load", scheduleHeight, { once: true });
      img.addEventListener("error", scheduleHeight, { once: true });
    });
  }

  function observeContent() {
    if (typeof ResizeObserver === "undefined") return;
    if (!contentRO) contentRO = new ResizeObserver(scheduleHeight);
    var widget = $(".pf-widget");
    var root = $("#pf-root");
    if (widget) contentRO.observe(widget);
    if (root) contentRO.observe(root);
    if (document.body) contentRO.observe(document.body);
  }

  function applyViewport(offsetTop, height, mode) {
    var root = document.documentElement;
    if (mode === "fixed") {
      root.classList.add("pf-iframe-fixed");
      root.style.setProperty("--pf-vis-top", "0px");
      root.style.setProperty("--pf-vis-height", "100%");
      return;
    }
    root.classList.remove("pf-iframe-fixed");
    var top = Math.max(0, Math.round(Number(offsetTop) || 0));
    var h = Math.max(120, Math.round(Number(height) || 0));
    root.style.setProperty("--pf-vis-top", top + "px");
    root.style.setProperty("--pf-vis-height", h + "px");
  }

  function clearViewport() {
    var root = document.documentElement;
    root.classList.remove("pf-iframe-fixed");
    root.classList.remove("pf-await-viewport");
    root.style.removeProperty("--pf-vis-top");
    root.style.removeProperty("--pf-vis-height");
  }

  function measureScrollbar() {
    return Math.max(0, window.innerWidth - document.documentElement.clientWidth);
  }

  function lockPageGutter() {
    document.documentElement.style.setProperty("--pf-sbw", measureScrollbar() + "px");
  }

  function unlockPageGutter() {
    document.documentElement.style.removeProperty("--pf-sbw");
  }

  function setPopupOpen(open) {
    open = !!open;
    var overlay = $("#pf-overlay");
    if (!overlay) return;
    if (open && state.popupLeaving) return;
    if (state.popupOpen === open) {
      if (open) postToParent({ type: MODAL_TYPE, open: true });
      return;
    }
    if (!open && state.popupOpen) {
      state.popupLeaving = true;
      postToParent({ type: CLOSING_TYPE });
      overlay.classList.add("is-leaving");
      overlay.classList.remove("is-open");
      setTimeout(function () {
        state.popupOpen = false;
        state.popupLeaving = false;
        overlay.classList.remove("is-leaving");
        overlay.setAttribute("aria-hidden", "true");
        document.documentElement.classList.remove("pf-modal-open");
        document.body.classList.remove("pf-lock");
        unlockPageGutter();
        clearViewport();
        postToParent({ type: MODAL_TYPE, open: false });
        lastHeight = 0;
        scheduleHeight();
      }, leaveMs);
      return;
    }
    state.popupOpen = true;
    overlay.classList.remove("is-leaving");
    overlay.classList.add("is-open");
    overlay.setAttribute("aria-hidden", "false");
    lockPageGutter();
    document.documentElement.classList.add("pf-modal-open");
    document.body.classList.add("pf-lock");
    if (inIframe) document.documentElement.classList.add("pf-await-viewport");
    else {
      var vv = window.visualViewport;
      applyViewport(vv ? vv.offsetTop : 0, vv ? vv.height : window.innerHeight);
    }
    postToParent({ type: MODAL_TYPE, open: true });
  }

  function openPayment(url) {
    if (!url) {
      window.alert("Ссылка на оплату ещё не задана. Укажите её в админке.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function renderHeader(cfg) {
    var h = cfg.header || {};
    return (
      '<header class="pf-header">' +
        '<div class="pf-header__row">' +
          '<h1 class="pf-header__title">' + esc(h.title) + "</h1>" +
          '<div class="pf-header__pills">' +
            '<span class="pf-pill pf-pill--start">' + esc(h.startLabel) + "</span>" +
            '<span class="pf-pill pf-pill--duration">' + esc(h.durationLabel) + "</span>" +
          "</div>" +
        "</div>" +
        '<p class="pf-header__sub">' + esc(h.subtitle) + "</p>" +
      "</header>"
    );
  }

  function renderPlashka(cfg) {
    var p = cfg.plashka;
    if (!p || p.visible === false) return "";
    var features = (p.features || []).map(function (f) {
      return '<p class="pf-check">' + esc(f) + "</p>";
    }).join("");
    return (
      '<section class="pf-plashka-wrap">' +
        '<div class="pf-plashka-head">' +
          '<p class="pf-plashka-head__title">' + esc(p.eyebrow) + "</p>" +
          (p.newBadge ? '<span class="pf-badge-new">' + esc(p.newBadge) + "</span>" : "") +
        "</div>" +
        '<div class="pf-plashka">' +
          '<div class="pf-plashka__top">' +
            (p.image ? '<img class="pf-plashka__img" src="' + esc(p.image) + '" alt="">' : "") +
            '<div class="pf-plashka__copy">' +
              '<p class="pf-plashka__title">' + esc(p.title) + "</p>" +
              '<p class="pf-plashka__text">' + esc(p.text) + "</p>" +
            "</div>" +
            '<div class="pf-plashka__price">' +
              '<p class="pf-plashka__from">' + esc(p.priceFrom) + "</p>" +
              '<p class="pf-plashka__instead">' + esc(p.priceInstead) + "</p>" +
            "</div>" +
          "</div>" +
          '<hr class="pf-plashka__line">' +
          '<div class="pf-plashka__bottom">' +
            (p.limeBadge ? '<span class="pf-lime">' + esc(p.limeBadge) + "</span>" : "") +
            features +
            '<div class="pf-plashka__cta"><button type="button" class="pf-btn" data-action="open-popup">' +
              esc(p.cta) +
            "</button></div>" +
          "</div>" +
        "</div>" +
      "</section>"
    );
  }

  function renderOption(card, opt, selectedId) {
    var active = opt.id === selectedId;
    var isSub = opt.action === "popup";
    var cls = "pf-opt" + (isSub ? " pf-opt--sub" : "") + (active ? " is-active" : "");
    var inner =
      '<span class="pf-opt__select"><i class="pf-radio" aria-hidden="true"></i>' +
      esc(opt.selectLabel || "выбрать") + "</span>";
    if (isSub) {
      inner +=
        '<span class="pf-opt__row">' +
          '<span class="pf-opt__label">' + esc(opt.label) + "</span>" +
          (opt.badge ? '<span class="pf-opt__best">' + esc(opt.badge) + "</span>" : "") +
        "</span>";
    } else {
      inner += '<span class="pf-opt__label">' + esc(opt.label) + "</span>";
    }
    return (
      '<button type="button" class="' + cls + '" data-card="' + esc(card.id) +
      '" data-option="' + esc(opt.id) + '">' + inner + "</button>"
    );
  }

  function renderCard(card) {
    var selectedId = state.selected[card.id];
    var opt = optionById(card, selectedId);
    var streams = (card.options || []).filter(function (o) { return o.action !== "popup"; });
    var subs = (card.options || []).filter(function (o) { return o.action === "popup"; });
    var tagCls = card.spotsLimited ? "pf-tag pf-tag--limited" : "pf-tag pf-tag--open";
    var extra = card.extraBadge
      ? '<span class="pf-tag pf-tag--extra">' + esc(card.extraBadge) + "</span>"
      : "";
    var buyLabel = opt.action === "popup" ? (state.config.plashka && state.config.plashka.cta) || "Оформить подписку" : card.buyLabel;
    return (
      '<article class="pf-card" data-card-id="' + esc(card.id) + '">' +
        (card.discountBadge ? '<span class="pf-card__badge">' + esc(card.discountBadge) + "</span>" : "") +
        '<h3 class="pf-card__title">' + esc(card.title) + "</h3>" +
        '<div class="pf-card__tags">' +
          (card.spotsLabel ? '<span class="' + tagCls + '">' + esc(card.spotsLabel) + "</span>" : "") +
          extra +
        "</div>" +
        '<p class="pf-card__desc">' + esc(card.description) + "</p>" +
        '<hr class="pf-card__rule">' +
        '<div class="pf-options">' +
          streams.map(function (o) { return renderOption(card, o, selectedId); }).join("") +
        "</div>" +
        subs.map(function (o) { return renderOption(card, o, selectedId); }).join("") +
        '<div class="pf-price">' +
          '<div>' +
            '<div class="pf-price__name pf-price__name--desk">' + esc(card.priceLabel) + "</div>" +
            '<div class="pf-price__name pf-price__name--mob">' + esc(card.priceLabelMobile || card.priceLabel) + "</div>" +
            (card.discountUntil ? '<p class="pf-price__until">' + esc(card.discountUntil) + "</p>" : "") +
          "</div>" +
          '<div class="pf-price__col">' +
            '<p class="pf-price__new">' + esc(opt.newPrice) + "</p>" +
            (opt.oldPrice ? '<p class="pf-price__old">' + esc(opt.oldPrice) + "</p>" : '<p class="pf-price__old"></p>') +
          "</div>" +
        "</div>" +
        '<button type="button" class="pf-btn pf-btn--block pf-card__buy" data-action="buy" data-card="' +
          esc(card.id) + '">' + esc(buyLabel) + "</button>" +
      "</article>"
    );
  }

  function renderCards(cfg) {
    var cards = visibleCards(cfg);
    return (
      '<p class="pf-renewal">' + esc(cfg.renewalTitle || "") + "</p>" +
      '<div class="pf-cards">' + cards.map(renderCard).join("") + "</div>"
    );
  }

  function renderPopup(cfg) {
    var pop = cfg.popup || {};
    var plans = pop.plans || [];
    var how = (pop.howItems || []).map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("");
    var fail = (pop.failItems || []).map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("");
    var planHtml = plans.map(function (plan, idx) {
      var active = idx === state.popupPlan;
      return (
        '<button type="button" class="pf-plan' + (active ? " is-active" : "") +
        '" data-action="popup-plan" data-plan="' + idx + '">' +
          '<div class="pf-plan__head">' +
            "<div>" +
              '<p class="pf-plan__cap">' + esc(pop.planCaption) + "</p>" +
              '<p class="pf-plan__name">' + esc(plan.title) + "</p>" +
            "</div>" +
            '<i class="pf-plan__radio" aria-hidden="true"></i>' +
          "</div>" +
          '<div class="pf-plan__row">' +
            "<span>" + esc(pop.oneTimeLabel) + "</span>" +
            '<span class="pf-plan__once">' + esc(plan.oneTimePrice) + "</span>" +
          "</div>" +
          '<hr class="pf-plan__hr">' +
          '<div class="pf-plan__row pf-plan__row--sub">' +
            "<span>" + esc(pop.subPriceLabel) + "</span>" +
            '<span class="pf-plan__subwrap">' +
              (plan.discountBadge ? '<span class="pf-plan__disc">' + esc(plan.discountBadge) + "</span>" : "") +
              '<span class="pf-plan__sub">' + esc(plan.subPrice) + "</span>" +
            "</span>" +
          "</div>" +
        "</button>"
      );
    }).join("");

    return (
      '<div class="pf-overlay" id="pf-overlay" aria-hidden="true">' +
        '<div class="pf-modal" role="dialog" aria-modal="true">' +
          '<button type="button" class="pf-modal__close" data-action="close-popup" aria-label="Закрыть"></button>' +
          "<div>" +
            '<p class="pf-modal__title">' + esc(pop.title) + "</p>" +
            '<p class="pf-modal__lead">' + esc(pop.lead) + "</p>" +
            '<p class="pf-modal__lead">' + esc(pop.lead2) + "</p>" +
          "</div>" +
          "<div>" +
            '<p class="pf-modal__label">' + esc(pop.chooseLabel) + "</p>" +
            planHtml +
          "</div>" +
          "<div>" +
            "<h3>" + esc(pop.howTitle) + "</h3>" +
            "<ul>" + how + "</ul>" +
          "</div>" +
          "<div>" +
            "<h3>" + esc(pop.failTitle) + "</h3>" +
            "<ul>" + fail + "</ul>" +
            '<p class="pf-modal__support">' + esc(pop.failSupportPrefix) + " " +
              '<a href="' + esc((cfg.meta && cfg.meta.supportUrl) || "#") + '" target="_blank" rel="noopener">' +
                esc((cfg.meta && cfg.meta.supportText) || "напишите в поддержку") +
              "</a>" +
            "</p>" +
          "</div>" +
          '<p class="pf-modal__rf">' + esc(pop.rfNote) + "</p>" +
          '<button type="button" class="pf-btn pf-btn--block" data-action="popup-buy">' + esc(pop.cta) + "</button>" +
        "</div>" +
      "</div>"
    );
  }

  function paintPopupContent() {
    var cfg = state.config;
    var overlay = $("#pf-overlay");
    if (!cfg || !overlay) return;
    var keepOpen = overlay.classList.contains("is-open");
    var keepLeaving = overlay.classList.contains("is-leaving");
    var html = renderPopup(cfg);
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    var next = wrap.firstElementChild;
    if (!next) return;
    next.classList.toggle("is-open", keepOpen);
    next.classList.toggle("is-leaving", keepLeaving);
    next.setAttribute("aria-hidden", keepOpen ? "false" : "true");
    overlay.replaceWith(next);
  }

  function paint() {
    var cfg = state.config;
    var root = $("#pf-root");
    if (!cfg || !root) return;
    var overlay = $("#pf-overlay");
    var widgetHtml =
      '<div class="pf-widget">' +
        renderHeader(cfg) +
        renderPlashka(cfg) +
        renderCards(cfg) +
      "</div>";
    if (overlay && state.popupOpen) {
      var widget = $(".pf-widget");
      if (widget) widget.outerHTML = widgetHtml;
      else root.insertAdjacentHTML("afterbegin", widgetHtml);
      paintPopupContent();
    } else {
      root.innerHTML = widgetHtml + renderPopup(cfg);
    }
    watchImages();
    observeContent();
    scheduleHeight();
  }

  function applyConfig(cfg) {
    state.config = cfg;
    visibleCards(cfg).forEach(function (card) {
      if (!state.selected[card.id]) {
        var def = card.options && card.options[card.defaultOption || 0];
        state.selected[card.id] = def ? def.id : (card.options[0] && card.options[0].id);
      }
    });
    if (cfg.popup && typeof cfg.popup.defaultPlan === "number") {
      state.popupPlan = cfg.popup.defaultPlan;
    }
    paint();
  }

  function onClick(e) {
    var btn = e.target.closest("[data-action], .pf-opt");
    if (!btn) {
      if (e.target.id === "pf-overlay") setPopupOpen(false);
      return;
    }
    var action = btn.getAttribute("data-action");
    if (btn.classList.contains("pf-opt")) {
      var cardId = btn.getAttribute("data-card");
      var optId = btn.getAttribute("data-option");
      state.selected[cardId] = optId;
      paint();
      return;
    }
    if (action === "open-popup") {
      setPopupOpen(true);
      return;
    }
    if (action === "close-popup") {
      setPopupOpen(false);
      return;
    }
    if (action === "popup-plan") {
      state.popupPlan = Number(btn.getAttribute("data-plan")) || 0;
      document.querySelectorAll(".pf-plan").forEach(function (el, i) {
        el.classList.toggle("is-active", i === state.popupPlan);
      });
      return;
    }
    if (action === "popup-buy") {
      var plan = state.config.popup.plans[state.popupPlan];
      openPayment(plan && plan.link);
      return;
    }
    if (action === "buy") {
      var id = btn.getAttribute("data-card");
      var c = visibleCards(state.config).find(function (x) { return x.id === id; });
      var o = c && optionById(c, state.selected[id]);
      if (!o) return;
      if (o.action === "popup") setPopupOpen(true);
      else openPayment(o.link);
    }
  }

  function bind() {
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.popupOpen) setPopupOpen(false);
    });
    window.addEventListener("message", function (event) {
      var data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === PING_TYPE) {
        scheduleHeight();
        if (state.popupOpen) postToParent({ type: MODAL_TYPE, open: true });
      }
      if (data.type === CLOSE_TYPE) setPopupOpen(false);
      if (data.type === VIEWPORT_TYPE) {
        applyViewport(data.offsetTop, data.height, data.mode);
        document.documentElement.classList.remove("pf-await-viewport");
      }
      if (data.type === CONFIG_TYPE && data.config) applyConfig(data.config);
    });
    function syncStandaloneViewport() {
      if (inIframe || !state.popupOpen || !window.visualViewport) return;
      applyViewport(window.visualViewport.offsetTop, window.visualViewport.height);
    }
    window.addEventListener("load", scheduleHeight);
    window.addEventListener("resize", function () {
      syncStandaloneViewport();
      scheduleHeight();
    });
    window.addEventListener("orientationchange", scheduleHeight);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", function () {
        syncStandaloneViewport();
        scheduleHeight();
      });
      window.visualViewport.addEventListener("scroll", syncStandaloneViewport);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(scheduleHeight).catch(function () {});
    }
    observeContent();
    if (typeof MutationObserver !== "undefined" && document.documentElement) {
      var heightTimer = 0;
      new MutationObserver(function (mutations) {
        var onlyAttrs = mutations.every(function (m) {
          return m.type === "attributes" || m.type === "characterData";
        });
        if (onlyAttrs) return;
        if (heightTimer) clearTimeout(heightTimer);
        heightTimer = setTimeout(scheduleHeight, 220);
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["class", "style"]
      });
    }
  }

  function configFile() {
    return document.documentElement.dataset.config || "config.json";
  }

  function draftKey() {
    var course = document.documentElement.dataset.course;
    return course ? "PF_ADMIN_DRAFT_" + course : "PF_ADMIN_DRAFT";
  }

  function draftFromStorage() {
    try {
      if (!/preview=1/.test(location.search)) return null;
      var raw = localStorage.getItem(draftKey());
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function loadConfig() {
    var draft = draftFromStorage();
    if (draft) {
      applyConfig(draft);
      return;
    }
    var file = configFile();
    var url = file + (file.indexOf("?") >= 0 ? "&" : "?") + "t=" + Date.now();
    fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(applyConfig)
      .catch(function (err) {
        console.error("[PF] " + file, err);
        $("#pf-root").innerHTML = "<p style='padding:24px;font-family:sans-serif'>Не удалось загрузить " + file + "</p>";
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (inIframe) {
      document.documentElement.classList.add("pf-embedded");
      document.body.classList.add("pf-embedded");
    }
    bind();
    loadConfig();
    scheduleHeight();
    [120, 500, 1200, 2400].forEach(function (ms) {
      setTimeout(scheduleHeight, ms);
    });
  });

  window.PFWidget = {
    applyConfig: applyConfig,
    sendHeight: sendHeight
  };
})();
