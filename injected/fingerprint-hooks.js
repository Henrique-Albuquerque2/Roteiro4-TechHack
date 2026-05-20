(function () {
  "use strict";
  if (window.__privacyLensHooked) return;
  window.__privacyLensHooked = true;

  const THROTTLE_MS = 250;
  const lastEmit = new Map();

  function callerScript() {
    try {
      const stack = new Error().stack || "";
      const lines = stack.split("\n");
      for (const line of lines.slice(2)) {
        const m = line.match(/https?:\/\/[^\s):]+/);
        if (m) return m[0];
      }
    } catch (_) {}
    return "";
  }

  function emit(surface, api, detail) {
    const key = `${surface}|${api}`;
    const now = Date.now();
    if (lastEmit.has(key) && now - lastEmit.get(key) < THROTTLE_MS) return;
    lastEmit.set(key, now);
    try {
      window.postMessage({
        __privacyLens: true,
        surface,
        api,
        detail: detail || "",
        scriptUrl: callerScript()
      }, "*");
    } catch (_) {}
  }

  function wrap(target, prop, surface, label) {
    if (!target || !(prop in target)) return;
    const original = target[prop];
    if (typeof original !== "function") return;
    try {
      target[prop] = function (...args) {
        emit(surface, label || prop);
        return original.apply(this, args);
      };
    } catch (_) {}
  }

  if (typeof HTMLCanvasElement !== "undefined") {
    wrap(HTMLCanvasElement.prototype, "toDataURL", "Canvas", "toDataURL");
    wrap(HTMLCanvasElement.prototype, "toBlob", "Canvas", "toBlob");
  }
  if (typeof CanvasRenderingContext2D !== "undefined") {
    wrap(CanvasRenderingContext2D.prototype, "getImageData", "Canvas", "getImageData");
  }

  function wrapWebgl(proto) {
    if (!proto || !proto.getParameter) return;
    const original = proto.getParameter;
    proto.getParameter = function (pname) {
      try {
        const ext = this.getExtension && this.getExtension("WEBGL_debug_renderer_info");
        if (ext) {
          if (pname === ext.UNMASKED_VENDOR_WEBGL) {
            emit("WebGL", "getParameter(UNMASKED_VENDOR_WEBGL)");
          } else if (pname === ext.UNMASKED_RENDERER_WEBGL) {
            emit("WebGL", "getParameter(UNMASKED_RENDERER_WEBGL)");
          }
        }
      } catch (_) {}
      return original.apply(this, arguments);
    };
  }
  if (typeof WebGLRenderingContext !== "undefined") wrapWebgl(WebGLRenderingContext.prototype);
  if (typeof WebGL2RenderingContext !== "undefined") wrapWebgl(WebGL2RenderingContext.prototype);

  if (typeof AudioContext !== "undefined") {
    wrap(AudioContext.prototype, "createOscillator", "AudioContext", "createOscillator");
    wrap(AudioContext.prototype, "createDynamicsCompressor", "AudioContext", "createDynamicsCompressor");
    wrap(AudioContext.prototype, "createAnalyser", "AudioContext", "createAnalyser");
  }
  if (typeof OfflineAudioContext !== "undefined") {
    const OriginalOAC = OfflineAudioContext;
    try {
      window.OfflineAudioContext = function (...args) {
        emit("AudioContext", "new OfflineAudioContext");
        return new OriginalOAC(...args);
      };
      window.OfflineAudioContext.prototype = OriginalOAC.prototype;
    } catch (_) {}
  }

  try {
    const navProto = Object.getPrototypeOf(navigator);
    const sensitive = ["userAgent","platform","language","languages","hardwareConcurrency","deviceMemory","plugins"];
    for (const prop of sensitive) {
      const desc = Object.getOwnPropertyDescriptor(navProto, prop);
      if (!desc || !desc.get) continue;
      const orig = desc.get;
      Object.defineProperty(navProto, prop, {
        get() {
          emit("Navigator", `read ${prop}`);
          return orig.call(this);
        },
        configurable: true
      });
    }
  } catch (_) {}

  try {
    const screenProto = Object.getPrototypeOf(screen);
    for (const prop of ["width","height","colorDepth","pixelDepth"]) {
      const desc = Object.getOwnPropertyDescriptor(screenProto, prop);
      if (!desc || !desc.get) continue;
      const orig = desc.get;
      Object.defineProperty(screenProto, prop, {
        get() {
          emit("Screen", `read ${prop}`);
          return orig.call(this);
        },
        configurable: true
      });
    }
  } catch (_) {}
})();
