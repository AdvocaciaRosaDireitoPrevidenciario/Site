(function () {
  "use strict";

  const cfg = window.CAMPAIGN_CONFIG || {};
  const pixelId = String(cfg.metaPixelId || "").trim();
  const isValidPixelId = /^\d{5,30}$/.test(pixelId);
  const pending = [];

  function randomId(prefix) {
    const entropy = (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return `${prefix || "evt"}-${entropy}`;
  }

  function normalizeData(data) {
    return Object.assign({
      campaign: cfg.campaignName || "beneficio_negado_inss",
      page_path: location.pathname
    }, data || {});
  }

  function dispatch(type, eventName, data, options) {
    if (!isValidPixelId || typeof window.fbq !== "function") {
      pending.push([type, eventName, data, options]);
      return false;
    }
    window.fbq(type, eventName, normalizeData(data), options || {});
    return true;
  }

  window.CampaignTracking = {
    isPixelConfigured: isValidPixelId,
    newEventId: randomId,
    track: function (eventName, data, eventId) {
      return dispatch("track", eventName, data, eventId ? { eventID: eventId } : undefined);
    },
    trackCustom: function (eventName, data, eventId) {
      return dispatch("trackCustom", eventName, data, eventId ? { eventID: eventId } : undefined);
    }
  };

  if (!isValidPixelId) {
    return;
  }

  /* Código-base oficial do Meta Pixel, carregado apenas após existir um ID válido. */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
  (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

  window.fbq("init", pixelId);
  window.fbq("track", "PageView");
  pending.splice(0).forEach(args => dispatch.apply(null, args));
})();
