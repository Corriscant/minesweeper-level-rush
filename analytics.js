(function (root, document) {
  "use strict";

  var CONSENT_STORAGE_KEY = "minesweeper.analytics.consent.v1";
  var CONSENT_UNKNOWN = "unknown";
  var CONSENT_GRANTED = "granted";
  var CONSENT_DENIED = "denied";
  var MAX_PARAMETER_LENGTH = 100;
  var ALLOWED_EVENTS = Object.freeze({
    unity_loaded: true,
    game_started: true,
    level_completed: true,
    play_store_clicked: true
  });
  var PLAY_STORE_HOST = "play.google.com";
  var PLAY_STORE_PATH = "/store/apps/details";
  var PLAY_STORE_PACKAGE = "com.corriscant.minesweeper";

  var config = root.minesweeperAnalyticsConfig || {};
  var measurementId = typeof config.measurementId === "string" ? config.measurementId.trim() : "";
  var configured = /^G-[A-Z0-9]{6,}$/.test(measurementId) && measurementId !== "G-XXXXXXXXXX";
  var consentState = readConsentState();
  var tagInitialized = false;
  var consentPanelOpen = consentState === CONSENT_UNKNOWN;
  var consentUi = null;

  root.dataLayer = root.dataLayer || [];

  /**
   * Adds a command to the standard Google tag queue without requiring the remote script to be ready.
   */
  function gtag() {
    root.dataLayer.push(arguments);
  }

  try {
    gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied"
    });
  } catch (error) {
  }

  /**
   * Returns a bounded text value suitable for a low-cardinality analytics parameter.
   */
  function sanitizeParameter(value) {
    if (typeof value !== "string") {
      return "";
    }

    return value.trim().substring(0, MAX_PARAMETER_LENGTH);
  }

  /**
   * Reads the stored analytics choice without making page startup depend on browser storage.
   */
  function readConsentState() {
    try {
      var stored = root.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored === CONSENT_GRANTED || stored === CONSENT_DENIED) {
        return stored;
      }
    } catch (error) {
    }

    return CONSENT_UNKNOWN;
  }

  /**
   * Keeps the consent decision for later visits when first-party storage is available.
   */
  function persistConsentState(state) {
    try {
      root.localStorage.setItem(CONSENT_STORAGE_KEY, state);
    } catch (error) {
    }
  }

  /**
   * Creates an event payload with a stable Web source and bounded project-owned parameters.
   */
  function createEventParameters(additionalParameters) {
    var parameters = { event_source: "unity_webgl" };

    if (!additionalParameters || typeof additionalParameters !== "object") {
      return parameters;
    }

    var additionalKeys = Object.keys(additionalParameters);
    for (var additionalIndex = 0; additionalIndex < additionalKeys.length; additionalIndex++) {
      var key = additionalKeys[additionalIndex];
      var value = sanitizeParameter(additionalParameters[key]);
      if (value) {
        parameters[key] = value;
      }
    }

    return parameters;
  }

  /**
   * Queues one approved browser demo event when analytics is configured.
   */
  function trackEvent(eventName, parameters) {
    if (!configured || consentState !== CONSENT_GRANTED || !ALLOWED_EVENTS[eventName]) {
      return false;
    }

    try {
      gtag("event", eventName, createEventParameters(parameters));
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Tracks a project-owned Google Play transition without changing the original navigation action.
   */
  function trackPlayStoreClick(url) {
    try {
      var destination = new URL(url, root.location.href);
      if (destination.protocol !== "https:" ||
          destination.hostname !== PLAY_STORE_HOST ||
          destination.pathname !== PLAY_STORE_PATH ||
          destination.searchParams.get("id") !== PLAY_STORE_PACKAGE) {
        return false;
      }

      return trackEvent("play_store_clicked", {
        link_url: destination.href,
        link_campaign: destination.searchParams.get("utm_campaign") || ""
      });
    } catch (error) {
      return false;
    }
  }

  /**
   * Sends the current Consent Mode v2 choice while keeping advertising consent disabled.
   */
  function updateGoogleConsent(state) {
    try {
      gtag("consent", "update", {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: state === CONSENT_GRANTED ? "granted" : "denied"
      });
    } catch (error) {
    }
  }

  /**
   * Installs the asynchronous Google tag after consent; GA4 owns the initial page view and URL attribution.
   */
  function initializeTag() {
    if (!configured || consentState !== CONSENT_GRANTED || tagInitialized) {
      return false;
    }

    try {
      tagInitialized = true;
      gtag("js", new Date());
      gtag("config", measurementId);

      var script = document.createElement("script");
      script.async = true;
      script.id = "minesweeper-ga4-script";
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
      script.onerror = function () {
      };
      (document.head || document.documentElement).appendChild(script);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Applies a visitor's analytics choice without changing or delaying Unity startup.
   */
  function setConsentState(state) {
    if (!configured || (state !== CONSENT_GRANTED && state !== CONSENT_DENIED)) {
      return false;
    }

    consentState = state;
    consentPanelOpen = false;
    persistConsentState(state);
    updateGoogleConsent(state);

    if (state === CONSENT_GRANTED) {
      initializeTag();
    }

    updateConsentUi();
    return true;
  }

  /**
   * Adds the small, page-owned analytics consent controls after the document body exists.
   */
  function createConsentUi() {
    if (!configured || consentUi || !document.body) {
      return;
    }

    try {
      var style = document.createElement("style");
      style.id = "minesweeper-analytics-consent-style";
      style.textContent =
        "#minesweeper-analytics-consent{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);" +
        "box-sizing:border-box;width:min(520px,calc(100% - 24px));z-index:2147483647;padding:16px;" +
        "border:1px solid rgba(255,255,255,.28);border-radius:12px;background:rgba(24,24,24,.97);" +
        "box-shadow:0 8px 28px rgba(0,0,0,.45);color:#fff;font:14px/1.45 Arial,sans-serif}" +
        "#minesweeper-analytics-consent[hidden],#minesweeper-analytics-settings[hidden]{display:none!important}" +
        "#minesweeper-analytics-consent h2{margin:0 0 6px;font-size:17px}" +
        "#minesweeper-analytics-consent p{margin:0 0 14px;color:#eee}" +
        ".minesweeper-analytics-actions{display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap}" +
        ".minesweeper-analytics-button{min-height:38px;padding:8px 14px;border:1px solid #aaa;border-radius:8px;" +
        "background:#333;color:#fff;font:600 14px Arial,sans-serif;cursor:pointer}" +
        ".minesweeper-analytics-button:focus-visible{outline:3px solid #fff;outline-offset:2px}" +
        "#minesweeper-analytics-settings{position:fixed;left:10px;bottom:8px;z-index:2147483646;" +
        "padding:5px 8px;border:0;border-radius:6px;background:rgba(24,24,24,.76);color:#ddd;" +
        "font:12px Arial,sans-serif;cursor:pointer}";
      (document.head || document.documentElement).appendChild(style);

      var settingsButton = document.createElement("button");
      settingsButton.id = "minesweeper-analytics-settings";
      settingsButton.type = "button";
      settingsButton.textContent = "Analytics settings";
      settingsButton.addEventListener("click", function () {
        consentPanelOpen = true;
        updateConsentUi();
        try {
          consentUi.grantButton.focus({ preventScroll: true });
        } catch (error) {
        }
      });

      var panel = document.createElement("section");
      panel.id = "minesweeper-analytics-consent";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-modal", "false");
      panel.setAttribute("aria-labelledby", "minesweeper-analytics-consent-title");
      panel.setAttribute("aria-describedby", "minesweeper-analytics-consent-description");

      var title = document.createElement("h2");
      title.id = "minesweeper-analytics-consent-title";
      title.textContent = "Optional analytics";

      var description = document.createElement("p");
      description.id = "minesweeper-analytics-consent-description";
      description.textContent =
        "Allow Google Analytics to measure visits and gameplay events so we can improve this WebGL demo. " +
        "The game works the same if you decline.";

      var actions = document.createElement("div");
      actions.className = "minesweeper-analytics-actions";

      var denyButton = document.createElement("button");
      denyButton.type = "button";
      denyButton.className = "minesweeper-analytics-button";
      denyButton.textContent = "No thanks";
      denyButton.addEventListener("click", function () {
        setConsentState(CONSENT_DENIED);
        try {
          consentUi.settingsButton.focus({ preventScroll: true });
        } catch (error) {
        }
      });

      var grantButton = document.createElement("button");
      grantButton.type = "button";
      grantButton.className = "minesweeper-analytics-button";
      grantButton.textContent = "Allow analytics";
      grantButton.addEventListener("click", function () {
        setConsentState(CONSENT_GRANTED);
        try {
          consentUi.settingsButton.focus({ preventScroll: true });
        } catch (error) {
        }
      });

      actions.appendChild(denyButton);
      actions.appendChild(grantButton);
      panel.appendChild(title);
      panel.appendChild(description);
      panel.appendChild(actions);
      document.body.appendChild(settingsButton);
      document.body.appendChild(panel);

      consentUi = {
        panel: panel,
        settingsButton: settingsButton,
        grantButton: grantButton
      };
      updateConsentUi();
    } catch (error) {
      consentUi = null;
    }
  }

  /**
   * Updates consent control visibility without covering or pausing the Unity player.
   */
  function updateConsentUi() {
    if (!consentUi) {
      return;
    }

    var hasDecision = consentState === CONSENT_GRANTED || consentState === CONSENT_DENIED;
    var showPanel = !hasDecision || consentPanelOpen;
    consentUi.panel.hidden = !showPanel;
    consentUi.settingsButton.hidden = !hasDecision || showPanel;
  }

  /**
   * Makes the consent UI available without assuming the script runs after the body tag.
   */
  function scheduleConsentUi() {
    if (!configured) {
      return;
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createConsentUi, { once: true });
      return;
    }

    createConsentUi();
  }

  /**
   * Reopens analytics choices for visitors who want to grant or withdraw consent.
   */
  function openConsentSettings() {
    if (!configured) {
      return false;
    }

    consentPanelOpen = true;
    createConsentUi();
    updateConsentUi();
    return true;
  }

  root.minesweeperAnalytics = Object.freeze({
    isEnabled: function () {
      return configured && consentState === CONSENT_GRANTED;
    },
    getConsentState: function () {
      return consentState;
    },
    setConsent: setConsentState,
    openConsentSettings: openConsentSettings,
    trackEvent: trackEvent,
    trackPlayStoreClick: trackPlayStoreClick
  });

  if (consentState === CONSENT_GRANTED || consentState === CONSENT_DENIED) {
    updateGoogleConsent(consentState);
  }

  if (consentState === CONSENT_GRANTED) {
    initializeTag();
  }

  scheduleConsentUi();
})(window, document);
