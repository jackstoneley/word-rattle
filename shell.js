/* Stoneley Games shell, loaded at the end of every game page (games/<id>/index.html).
   - Website: registers the offline service worker (sw.js at the site root).
   - Android app: routes the phone's back button. A game may define window.SG_BACK();
     returning true means the game handled it, false (or no SG_BACK) goes back to the games list.
   - Android app: game links opened while another game is showing go to Link Up (#lu.…) or Word Rattle. */
(function () {
  var HUB = "../../index.html";
  var APP = !!(window.SG_APP || window.WR_APP);
  window.SG = window.SG || {};
  window.SG.app = APP;
  window.SG.hub = HUB;
  window.SG.goHub = function () { location.href = HUB; };

  if (!APP && "serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    try { navigator.serviceWorker.register(new URL("../../sw.js", location.href).href).catch(function () {}); } catch (e) {}
  }

  if (!APP || !window.Capacitor) return;
  var P = typeof Capacitor.registerPlugin === "function" ? Capacitor.registerPlugin("WordRattle") : (Capacitor.Plugins || {}).WordRattle;
  if (!P) return;
  window.SG.native = P;
  P.addListener("back", function () {
    var handled = false;
    try { handled = !!(window.SG_BACK && window.SG_BACK()); } catch (e) {}
    if (!handled) location.href = HUB;
  });
  if (!window.SG_HANDLES_LINKS) {
    P.addListener("appUrl", function (e) {
      var url = e && e.url ? String(e.url) : "";
      var i = url.indexOf("#");
      if (i >= 0 && url.length > i + 1) location.href = (/^#lu\./.test(url.slice(i)) ? "../link-up/" : "../word-rattle/") + "index.html" + url.slice(i);
    });
  }
})();
