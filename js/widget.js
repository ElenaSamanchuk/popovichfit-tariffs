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
    popupOpen: false
  };

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

  function sendHeight() {
    var root = $("#pf-root");
    if (!root) return;
    var height = Math.ceil(Math.max(
      root.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.scrollHeight
    ));
    postToParent({ type: RESIZE_TYPE, height: height });
  }

  function setPopupOpen(open) {
    open = !!open;
    var overlay = $("#pf-overlay");
    if (!overlay) return;
    if (state.popupOpen === open) return;
    if (!open && state.popupOpen) {
      postToParent({ type: CLOSING_TYPE });
    }
    state.popupOpen = open;
    overlay.classList.toggle("is-open", open);
    overlay.setAttribute("aria-hidden", open ? "false" : "true");
    document.body.classList.toggle("pf-lock", open);
    postToParent({ type: MODAL_TYPE, open: open });
    sendHeight();
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
            '<div class="pf-price__name">' + esc(card.priceLabel) + "</div>" +
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

  function paint() {
    var cfg = state.config;
    var root = $("#pf-root");
    if (!cfg || !root) return;
    root.innerHTML =
      '<div class="pf-widget">' +
        renderHeader(cfg) +
        renderPlashka(cfg) +
        renderCards(cfg) +
      "</div>" +
      renderPopup(cfg);
    if (state.popupOpen) {
      var overlay = $("#pf-overlay");
      if (overlay) {
        overlay.classList.add("is-open");
        overlay.setAttribute("aria-hidden", "false");
      }
    }
    requestAnimationFrame(sendHeight);
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
      var card = visibleCards(state.config).find(function (c) { return c.id === cardId; });
      var opt = card && optionById(card, optId);
      paint();
      if (opt && opt.action === "popup") setPopupOpen(true);
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
      paint();
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
      if (data.type === PING_TYPE) sendHeight();
      if (data.type === CLOSE_TYPE) setPopupOpen(false);
      if (data.type === VIEWPORT_TYPE && data.height) {
        var overlay = $("#pf-overlay");
        if (overlay && state.popupOpen) {
          overlay.style.alignItems = "flex-start";
          overlay.style.paddingTop = Math.max(8, Number(data.offsetTop) || 8) + "px";
        }
      }
      if (data.type === CONFIG_TYPE && data.config) applyConfig(data.config);
    });
    window.addEventListener("resize", sendHeight);
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(sendHeight);
      if (document.body) ro.observe(document.body);
    }
  }

  function draftFromStorage() {
    try {
      if (!/preview=1/.test(location.search)) return null;
      var raw = localStorage.getItem("PF_ADMIN_DRAFT");
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
    var url = "config.json?t=" + Date.now();
    fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(applyConfig)
      .catch(function (err) {
        console.error("[PF] config.json", err);
        $("#pf-root").innerHTML = "<p style='padding:24px;font-family:sans-serif'>Не удалось загрузить config.json</p>";
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    bind();
    loadConfig();
    setTimeout(sendHeight, 300);
    setTimeout(sendHeight, 1000);
  });

  window.PFWidget = {
    applyConfig: applyConfig,
    sendHeight: sendHeight
  };
})();
