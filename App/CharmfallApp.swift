import SwiftUI
import WebKit
import AVFoundation

@main
struct CharmfallApp: App {
    init() {
        // Game sound plays even when the ring switch is on silent, and does not stop the player's own music.
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
    }

    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color(red: 28 / 255, green: 94 / 255, blue: 52 / 255))   // the game's own forest green (#1c5e34), the same as the launch screen
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
        }
    }
}

/// The game is the web build, bundled in the app and shown full screen. Nothing is loaded from the network.
struct GameView: UIViewRepresentable {
    /// True on an iPhone 13 (hardware model iPhone14,5); the one-time lives refill below is for that phone only.
    static let isIPhone13: Bool = {
        var info = utsname(); uname(&info)
        return ["iPhone14,5", "iPhone17,3"].contains(withUnsafeBytes(of: &info.machine) { String(decoding: $0.prefix(while: { $0 != 0 }), as: UTF8.self) })   // İdris's iPhone 13 and iPhone 16: lives always full
    }()
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        // Game audio should play even with the ring switch on silent, and should not stop the user's music.
        try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
        try? AVAudioSession.sharedInstance().setActive(true)
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let content = config.userContentController
        content.add(context.coordinator, name: "haptic")
        content.add(context.coordinator, name: "ws")
        content.add(context.coordinator, name: "share")
        content.addScriptMessageHandler(context.coordinator, contentWorld: .page, name: "api")
        #if DEBUG
        content.add(context.coordinator, name: "log")
        NSLog("CHARMLOG screen maxFps=%d lowPower=%d", UIScreen.main.maximumFramesPerSecond, ProcessInfo.processInfo.isLowPowerModeEnabled ? 1 : 0)
        #endif
        // The web build buzzes with navigator.vibrate, which iOS does not have: route it to the Taptic Engine.
        // Links back to the web arcade make no sense inside the app, so they are hidden.
        let boot = """
        navigator.vibrate = function (p) { try { webkit.messageHandlers.haptic.postMessage(Array.isArray(p) ? p.reduce(function (a, b) { return a + b; }, 0) : (p || 0)); } catch (e) {} return true; };
        window.__nativeApp = true;
        // iOS caps web content at 30 fps in Low Power Mode; the game reads this to explain the slower motion in its settings.
        window.__lowPower = \(ProcessInfo.processInfo.isLowPowerModeEnabled);
        // Unlimited lives on the iPhone 13 only (asked for on 2026-10-12): the game keeps lives full and never spends one while this is set.
        window.__infLives = \(Self.isIPhone13);
        // One-time courtesy refill of lives (asked for three times on 2026-10-12, the third for the iPhone 13 only, hence the model check; bump the key to refill again): runs once per install, before the game reads its save.
        try { if (\(Self.isIPhone13) && !localStorage.getItem('charm.refill3')) { var sv = JSON.parse(localStorage.getItem('prismpop.v5') || 'null'); if (sv) { sv.lives = 5; sv.lifeAt = Date.now(); localStorage.setItem('prismpop.v5', JSON.stringify(sv)); } localStorage.setItem('charm.refill3', '1'); } } catch (e) {}
        // Sound: keep a list of every audio context the game makes, ask iOS for the "playback" route so the ring switch
        // does not silence the game, and wake any context that is not running on every touch.
        (function () {
          var Base = window.AudioContext || window.webkitAudioContext; if (!Base) return;
          var all = window.__ctxs = [];
          var Tracked = class extends Base { constructor(o) { super(o); all.push(this); } };
          window.AudioContext = Tracked; if (window.webkitAudioContext) window.webkitAudioContext = Tracked;
          // Belt and braces for the ring switch: a looping <audio> element of real (silent) samples puts the page in the media-playback route, which Web Audio then shares.
          // The clip must hold actual audio data: an empty one ends at once and never claims the route, which left the game mute on phones with the switch on silent.
          var hush = null, startHush = function () { try { if (window.__quiet) return;
            if (!hush) { var n = 8000, w = new Uint8Array(44 + n), v = new DataView(w.buffer), put = function (o, s) { for (var i = 0; i < s.length; i++) w[o + i] = s.charCodeAt(i); };
              put(0, 'RIFF'); v.setUint32(4, 36 + n, true); put(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); put(36, 'data'); v.setUint32(40, n, true); w.fill(128, 44);
              hush = new Audio(URL.createObjectURL(new Blob([w], { type: 'audio/wav' }))); hush.loop = true; hush.setAttribute('playsinline', ''); window.__hush = hush; }
            if (hush.paused) { var pr = hush.play(); if (pr && pr.catch) pr.catch(function () {}); } } catch (e) {} };
          ['touchstart', 'touchend', 'click'].forEach(function (t) { addEventListener(t, startHush, true); });
          document.addEventListener('DOMContentLoaded', function () { window.__audioMode(); });
          var wake = function () { if (window.__quiet) return; all.forEach(function (c) { if (c.state !== 'running') { try { c.resume(); } catch (e) {} } }); };
          // Quiet mode: with the game's sound off, or while another app is playing music, the page asks for the "ambient" route (which mixes with
          // other audio), stops the silent clip and suspends every audio context, so Spotify and YouTube keep playing. Otherwise "playback" beats the ring switch.
          window.__audioMode = function () { var off = false; try { off = JSON.parse(localStorage.getItem('prismpop.v5') || '{}').sound === false; } catch (e) {} var quiet = off || !!window.__otherAudio; window.__quiet = quiet;
            try { if (navigator.audioSession) navigator.audioSession.type = quiet ? 'ambient' : 'playback'; } catch (e) {}
            if (quiet) { try { if (hush) hush.pause(); } catch (e) {} all.forEach(function (c) { if (c.state === 'running' && c.suspend) { try { c.suspend(); } catch (e) {} } }); } else { startHush(); wake(); } };
          window.__setAudio = function (other) { window.__otherAudio = !!other; window.__audioMode(); };
          ['touchstart', 'touchend', 'pointerup', 'click'].forEach(function (t) { addEventListener(t, wake, true); });
          // Battery (2026-10-23): the silent clip and the audio contexts keep the sound hardware awake, so they stop whenever the game is hidden
          // or nobody has touched it for 20 seconds; the next touch starts them again.
          var rest = function () { try { if (hush && !hush.paused) hush.pause(); } catch (e) {} all.forEach(function (c) { if (c.state === 'running' && c.suspend) { try { c.suspend(); } catch (e) {} } }); };
          var touched = Date.now(); ['touchstart', 'pointerdown'].forEach(function (t) { addEventListener(t, function () { touched = Date.now(); }, true); });
          setInterval(function () { if (Date.now() - touched > 20000) rest(); }, 5000);
          document.addEventListener('visibilitychange', function () { if (document.hidden) rest(); else setTimeout(function () { touched = Date.now(); wake(); startHush(); }, 150); });
          window.__wake = wake; window.__rest = rest;
        })();
        // Friends rooms: the bundled page has no web origin, so account calls and the room socket go through the app instead.
        (function () {
          var realFetch = window.fetch;
          window.fetch = function (u, o) {
            if (typeof u === 'string' && u.indexOf('/api/') === 0) { o = o || {}; var h = o.headers || {};
              return webkit.messageHandlers.api.postMessage({ path: u, method: o.method || 'GET', body: o.body || '', auth: h.authorization || '' }).then(function (r) { return new Response(r.body, { status: r.status, headers: { 'content-type': 'application/json' } }); }); }
            return realFetch.apply(this, arguments);
          };
          var RealWS = window.WebSocket, socks = {}, n = 0;
          var NWS = function (url) { if (String(url).indexOf('wss://launch.mountlayer.com/') !== 0) return new RealWS(url); this.id = ++n; this.url = url; this.readyState = 0; socks[this.id] = this; webkit.messageHandlers.ws.postMessage({ op: 'open', id: this.id, url: String(url) }); };
          NWS.CONNECTING = 0; NWS.OPEN = 1; NWS.CLOSING = 2; NWS.CLOSED = 3;
          NWS.prototype.send = function (d) { if (this.readyState !== 1) throw new Error('socket not open'); webkit.messageHandlers.ws.postMessage({ op: 'send', id: this.id, data: String(d) }); };
          NWS.prototype.close = function () { if (this.readyState >= 2) return; this.readyState = 2; webkit.messageHandlers.ws.postMessage({ op: 'close', id: this.id }); };
          window.__ws = function (id, ev, data) { var s = socks[id]; if (!s) return;
            if (ev === 'open') { s.readyState = 1; if (s.onopen) s.onopen({}); }
            else if (ev === 'message') { if (s.onmessage) s.onmessage({ data: data }); }
            else { s.readyState = 3; delete socks[id]; if (ev === 'error' && s.onerror) s.onerror({}); if (s.onclose) s.onclose({ code: 1006 }); } };
          window.WebSocket = NWS;
        })();
        if (document.documentElement) document.documentElement.classList.add('app');
        document.addEventListener('DOMContentLoaded', function () {
          document.documentElement.classList.add('app');
          var s = document.createElement('style');
          s.textContent = 'a[href="../games/"]{display:none!important} body{-webkit-touch-callout:none}';
          document.head.appendChild(s);
          var logo = document.querySelector('.logo'); if (logo) logo.innerHTML = 'Charm<span>fall</span>';
          document.title = 'Charmfall';
          // (frame-rate probes go here when measuring; nothing may scroll or play on its own in a build that is left on a phone)
          if (webkit.messageHandlers.log) { var L = function (s) { webkit.messageHandlers.log.postMessage(s); }; setTimeout(async function () { try { document.querySelectorAll('.modal').forEach(function (m) { m.hidden = true; }); __g.start(5); await new Promise(function (r) { setTimeout(r, 1500); }); var G = __g.G, dts = [], last = performance.now(); var tick = function (ts) { dts.push(ts - last); last = ts; if (!G.over && dts.length < 900) requestAnimationFrame(tick); }; requestAnimationFrame(tick); var n = 0; var t0 = performance.now(); while (!G.over && n++ < 40 && performance.now() - t0 < 9000) { if (G.busy) { await new Promise(function (r) { setTimeout(r, 30); }); continue; } var m = __g.best(); if (!m) { await new Promise(function (r) { setTimeout(r, 30); }); continue; } await __g.swap(m[0][0], m[0][1], m[1][0], m[1][1]); } G.over = true; var tot = dts.length, slow = dts.filter(function (d) { return d > 20; }).length, vslow = dts.filter(function (d) { return d > 34; }).length, avg = dts.reduce(function (a, b) { return a + b; }, 0) / tot; L('BOARD frames=' + tot + ' avg=' + avg.toFixed(1) + 'ms fps=' + (1000 / avg).toFixed(0) + ' >20ms=' + slow + ' >34ms=' + vslow + ' dpr=' + devicePixelRatio + ' canvas=' + document.getElementById('c').width + 'x' + document.getElementById('c').height + ' q=' + Arcade.gfx.quality); } catch (e) { L('BOARD err ' + e); } }, 7000); }
          if (webkit.messageHandlers.log) setTimeout(function () { try { SFX.swap(); window.__wake(); } catch (e) {} setTimeout(function () { webkit.messageHandlers.log.postMessage('ctx=' + (window.__ctxs || []).map(function (c) { return c.state + '@' + c.sampleRate + ' t=' + c.currentTime.toFixed(2); }).join('|') + ' session=' + (navigator.audioSession ? navigator.audioSession.type : 'none') + ' hush=' + (window.__hush ? (window.__hush.paused ? 'paused' : 'playing') + '@' + window.__hush.currentTime.toFixed(2) : 'none') + ' vol=' + localStorage.getItem('arcade_vol') + ' sound=' + (function () { try { return JSON.parse(localStorage.getItem('prismpop.v5')).sound; } catch (e) { return 'n/a'; } })()); }, 1500); }, 2500);
        });
        """
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        context.coordinator.web = web
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 28 / 255, green: 94 / 255, blue: 52 / 255, alpha: 1)
        web.alpha = 0   // shown once the page has drawn, so nothing but the green comes before the game
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        NotificationCenter.default.addObserver(forName: .NSProcessInfoPowerStateDidChange, object: nil, queue: .main) { [weak web] _ in web?.evaluateJavaScript("window.__lowPower = \(ProcessInfo.processInfo.isLowPowerModeEnabled)", completionHandler: nil) }
        #endif
        if let root = Bundle.main.url(forResource: "Web", withExtension: nil) {
            // The game ships inside the app: drop any cached copy of it first, so a new install always shows the new build (saves live in localStorage and are kept)
            let caches: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeFetchCache, WKWebsiteDataTypeServiceWorkerRegistrations]
            WKWebsiteDataStore.default().removeData(ofTypes: caches, modifiedSince: Date(timeIntervalSince1970: 0)) {}
            web.loadFileURL(root.appendingPathComponent("prism/index.html"), allowingReadAccessTo: root)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKScriptMessageHandlerWithReply {
        weak var web: WKWebView?
        private var socks: [Int: URLSessionWebSocketTask] = [:]
        private let live = "https://launch.mountlayer.com"

        // Account calls for friends rooms, passed on to the live site.
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
            guard let m = message.body as? [String: Any], let path = m["path"] as? String, path.hasPrefix("/api/"), let url = URL(string: live + path) else { replyHandler(nil, "bad request"); return }
            var req = URLRequest(url: url); req.httpMethod = (m["method"] as? String) ?? "GET"
            req.setValue("application/json", forHTTPHeaderField: "content-type")
            if let a = m["auth"] as? String, !a.isEmpty { req.setValue(a, forHTTPHeaderField: "authorization") }
            if let b = m["body"] as? String, !b.isEmpty { req.httpBody = b.data(using: .utf8) }
            URLSession.shared.dataTask(with: req) { data, resp, _ in
                let status = (resp as? HTTPURLResponse)?.statusCode ?? 503
                let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? "{\"ok\":false,\"error\":\"Could not reach the server.\"}"
                DispatchQueue.main.async { replyHandler(["status": status, "body": body], nil) }
            }.resume()
        }

        // The room socket: one native web socket per page socket, events sent back as window.__ws(id, event, data).
        private func emit(_ id: Int, _ ev: String, _ data: String = "") {
            guard let json = try? JSONSerialization.data(withJSONObject: [data]), let arr = String(data: json, encoding: .utf8) else { return }
            DispatchQueue.main.async { self.web?.evaluateJavaScript("window.__ws && window.__ws(\(id), '\(ev)', \(arr)[0])", completionHandler: nil) }
        }
        private func listen(_ id: Int, _ task: URLSessionWebSocketTask) {
            task.receive { [weak self] result in
                guard let self = self else { return }
                switch result {
                case .success(let msg):
                    if case .string(let s) = msg { self.emit(id, "message", s) } else if case .data(let d) = msg, let s = String(data: d, encoding: .utf8) { self.emit(id, "message", s) }
                    self.listen(id, task)
                case .failure:
                    DispatchQueue.main.async { if self.socks.removeValue(forKey: id) != nil { self.emit(id, "close") } }
                }
            }
        }
        private func socket(_ m: [String: Any]) {
            guard let op = m["op"] as? String, let id = m["id"] as? Int else { return }
            if op == "open", let u = m["url"] as? String, u.hasPrefix("wss://launch.mountlayer.com/"), let url = URL(string: u) {
                let task = URLSession.shared.webSocketTask(with: url); socks[id] = task; task.resume(); listen(id, task)
                task.sendPing { [weak self] err in if err == nil { self?.emit(id, "open") } else { DispatchQueue.main.async { if self?.socks.removeValue(forKey: id) != nil { self?.emit(id, "error") } } } }
            } else if op == "send", let d = m["data"] as? String { socks[id]?.send(.string(d)) { _ in } }
            else if op == "close" { if let t = socks.removeValue(forKey: id) { t.cancel(with: .normalClosure, reason: nil); emit(id, "close") } }
        }

        private let light = UIImpactFeedbackGenerator(style: .light)
        private let heavy = UIImpactFeedbackGenerator(style: .heavy)

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "ws" { if let m = message.body as? [String: Any] { socket(m) }; return }
            if message.name == "share" {
                // Invite a friend: the system share sheet; the page is told whether the invite was actually sent.
                guard let m = message.body as? [String: Any], let text = m["text"] as? String, let u = m["url"] as? String, let url = URL(string: u),
                      let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene, let root = scene.windows.first?.rootViewController else { return }
                let sheet = UIActivityViewController(activityItems: [text, url], applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = root.view
                sheet.completionWithItemsHandler = { [weak self] _, done, _, _ in self?.web?.evaluateJavaScript("window.__shared && window.__shared(\(done))", completionHandler: nil) }
                root.present(sheet, animated: true); return
            }
            if message.name == "log" { NSLog("CHARMLOG %@", String(describing: message.body)); return }
            let ms = (message.body as? NSNumber)?.doubleValue ?? 0
            (ms >= 30 ? heavy : light).impactOccurred()
        }

        // Anything that is not part of the bundled game (share links and the like) opens in Safari.
        private var activeObserver: NSObjectProtocol?
        private var backObserver: NSObjectProtocol?
        func watchAudio() {
            guard activeObserver == nil else { return }
            activeObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in self?.tellAudio() }
            // Battery: in the background the page stops its sound and the app gives the audio session back, so nothing keeps running
            backObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                self?.web?.evaluateJavaScript("window.__rest && window.__rest()", completionHandler: nil)
                try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
            }
        }
        func tellAudio() {
            try? AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers]); try? AVAudioSession.sharedInstance().setActive(true)
            let other = AVAudioSession.sharedInstance().isOtherAudioPlaying
            web?.evaluateJavaScript("window.__setAudio && window.__setAudio(\(other))", completionHandler: nil)
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { watchAudio(); tellAudio()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.12) { UIView.animate(withDuration: 0.25) { webView.alpha = 1 } } }

        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if url.isFileURL || url.scheme == "about" { decisionHandler(.allow); return }
            if url.scheme == "http" || url.scheme == "https" { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}
