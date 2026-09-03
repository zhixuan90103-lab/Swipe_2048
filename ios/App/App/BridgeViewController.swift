import UIKit
import Capacitor

/// Registers local plugins and locks portrait orientation.
@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController {
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var shouldAutorotate: Bool {
        false
    }

    /// 底边：第一次滑给游戏，回桌面需再滑（Home / 多任务）。
    /// 官方文档：系统边缘手势默认优先；沉浸式 App 可 defer 指定边。
    /// https://developer.apple.com/documentation/uikit/uiviewcontroller/preferredscreenedgesdeferringsystemgestures
    /// 不要同时 prefersHomeIndicatorAutoHidden，否则 defer 会失效。
    /// 从上往下扫过 Home 条触发的「半屏」是 Reachability，无公开 API 可关。
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        .bottom
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if let scroll = webView?.scrollView {
            scroll.bounces = false
            scroll.alwaysBounceVertical = false
            scroll.alwaysBounceHorizontal = false
            scroll.isScrollEnabled = false
        }
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AdvancedHapticsPlugin())
        bridge?.registerPluginInstance(NativeAudioPlugin())
        CAPLog.print("⚡️ AdvancedHapticsPlugin registered")
        CAPLog.print("⚡️ NativeAudioPlugin registered")
    }
}
