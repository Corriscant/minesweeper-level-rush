(function (root, document) {
  "use strict";

  var UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];
  var UTM_STORAGE_KEY = "minesweeper.analytics.utm";
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
  var enabled = /^G-[A-Z0-9]{6,}$/.test(measurementId) && measurementId !== "G-XXXXXXXXXX";
  var attribution = captureAttribution();

  root.dataLayer = root.dataLayer || [];

  /**
   * Adds a command to the standard Google tag queue without requiring the remote script to be ready.
   */
  function gtag() {
    root.dataLayer.push(arguments);
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
   * Captures supported UTM values from the landing URL and keeps them for this browser tab.
   */
  function captureAttribution() {
    var captured = {};

    try {
      var search = new URLSearchParams(root.location.search);
      for (var i = 0; i < UTM_KEYS.length; i++) {
        var key = UTM_KEYS[i];
        var value = sanitizeParameter(search.get(key));
        if (value) {
          captured[key] = value;
        }
      }

      if (Object.keys(captured).length > 0) {
        root.sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(captured));
        return captured;
      }

      var stored = root.sessionStorage.getItem(UTM_STORAGE_KEY);
      if (!stored) {
        return captured;
      }

      var parsed = JSON.parse(stored);
      for (var parsedIndex = 0; parsedIndex < UTM_KEYS.length; parsedIndex++) {
        var parsedKey = UTM_KEYS[parsedIndex];
        var parsedValue = sanitizeParameter(parsed[parsedKey]);
        if (parsedValue) {
          captured[parsedKey] = parsedValue;
        }
      }
    } catch (error) {
      return {};
    }

    return captured;
  }

  /**
   * Creates an event payload with stable Web source and captured campaign attribution.
   */
  function createEventParameters(additionalParameters) {
    var parameters = { event_source: "unity_webgl" };
    var attributionKeys = Object.keys(attribution);
    for (var i = 0; i < attributionKeys.length; i++) {
      var attributionKey = attributionKeys[i];
      parameters[attributionKey] = attribution[attributionKey];
    }

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
    if (!enabled || !ALLOWED_EVENTS[eventName]) {
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
   * Installs the asynchronous Google tag and sends the page view once without blocking Unity startup.
   */
  function initialize() {
    if (!enabled) {
      return;
    }

    try {
      gtag("js", new Date());
      gtag("config", measurementId, { send_page_view: false });
      gtag("event", "page_view", createEventParameters({
        page_title: document.title,
        page_location: root.location.href,
        page_path: root.location.pathname + root.location.search
      }));

      var script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(measurementId);
      script.onerror = function () {
      };
      document.head.appendChild(script);
    } catch (error) {
    }
  }

  root.minesweeperAnalytics = Object.freeze({
    isEnabled: function () {
      return enabled;
    },
    trackEvent: trackEvent,
    trackPlayStoreClick: trackPlayStoreClick
  });

  initialize();
})(window, document);
