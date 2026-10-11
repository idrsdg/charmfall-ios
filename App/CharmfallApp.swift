import SwiftUI
import WebKit

@main
struct CharmfallApp: App {
    var body: some Scene {
        WindowGroup {
            GameView()
                .ignoresSafeArea()
                .background(Color(red: 7 / 255, green: 6 / 255, blue: 28 / 255))
                .statusBarHidden(true)
                .persistentSystemOverlays(.hidden)
        }
    }
}

/// The game is the web build, bundled in the app and shown full screen. Nothing is loaded from the network.
struct GameView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let content = config.userContentController
        content.add(context.coordinator, name: "haptic")
        // The web build buzzes with navigator.vibrate, which iOS does not have: route it to the Taptic Engine.
        // Links back to the web arcade make no sense inside the app, so they are hidden.
        let boot = """
        navigator.vibrate = function (p) { try { webkit.messageHandlers.haptic.postMessage(Array.isArray(p) ? p.reduce(function (a, b) { return a + b; }, 0) : (p || 0)); } catch (e) {} return true; };
        window.__nativeApp = true;
        document.addEventListener('DOMContentLoaded', function () {
          var s = document.createElement('style');
          s.textContent = 'a[href="../games/"]{display:none!important} body{-webkit-touch-callout:none}';
          document.head.appendChild(s);
          var logo = document.querySelector('.logo'); if (logo) logo.innerHTML = 'Charm<span>fall</span>';
          document.title = 'Charmfall';
        });
        """
        content.addUserScript(WKUserScript(source: boot, injectionTime: .atDocumentStart, forMainFrameOnly: true))

        let web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = context.coordinator
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 7 / 255, green: 6 / 255, blue: 28 / 255, alpha: 1)
        web.scrollView.backgroundColor = web.backgroundColor
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.allowsLinkPreview = false
        #if DEBUG
        if #available(iOS 16.4, *) { web.isInspectable = true }
        #endif
        if let root = Bundle.main.url(forResource: "Web", withExtension: nil) {
            web.loadFileURL(root.appendingPathComponent("prism/index.html"), allowingReadAccessTo: root)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        private let light = UIImpactFeedbackGenerator(style: .light)
        private let heavy = UIImpactFeedbackGenerator(style: .heavy)

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            let ms = (message.body as? NSNumber)?.doubleValue ?? 0
            (ms >= 30 ? heavy : light).impactOccurred()
        }

        // Anything that is not part of the bundled game (share links and the like) opens in Safari.
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if url.isFileURL || url.scheme == "about" { decisionHandler(.allow); return }
            if url.scheme == "http" || url.scheme == "https" { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}
