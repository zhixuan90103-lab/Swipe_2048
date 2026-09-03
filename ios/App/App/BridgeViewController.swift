import UIKit
import Capacitor

/// Registers local plugins and locks portrait orientation.
@objc(BridgeViewController)
final class BridgeViewController: CAPBridgeViewController, UIGestureRecognizerDelegate {
    private var downPan: UIPanGestureRecognizer?
    private var edgeDownStrikes = 0
    private var lastEdgeDownAt: TimeInterval = 0
    private let edgeDownReset: TimeInterval = 5

    override var supportedInterfaceOrientations: UIInterfaceOrientationMask {
        .portrait
    }

    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation {
        .portrait
    }

    override var shouldAutorotate: Bool {
        false
    }

    /// 底边：第一次滑给游戏，回桌面需再滑。不要同时 prefersHomeIndicatorAutoHidden。
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
        installDownPan()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }

    /// Home 指示条高度一带（约 22pt）才拦向下。第一次吞掉，5s 内第二次放给系统。
    private func edgeBand() -> CGFloat {
        min(max(view.safeAreaInsets.bottom * 0.35, 10), 14)
    }

    private func refreshEdgeStrikes() {
        let now = ProcessInfo.processInfo.systemUptime
        if now - lastEdgeDownAt > edgeDownReset { edgeDownStrikes = 0 }
    }

    private func installDownPan() {
        guard downPan == nil else { return }
        let pan = UIPanGestureRecognizer(target: self, action: #selector(onDownPan(_:)))
        pan.maximumNumberOfTouches = 1
        pan.cancelsTouchesInView = true
        pan.delaysTouchesBegan = false
        pan.delaysTouchesEnded = false
        pan.delegate = self
        view.addGestureRecognizer(pan)
        downPan = pan
    }

    @objc private func onDownPan(_ pan: UIPanGestureRecognizer) {
        switch pan.state {
        case .ended, .cancelled, .failed:
            if pan.translation(in: view).y > 8 {
                refreshEdgeStrikes()
                edgeDownStrikes += 1
                lastEdgeDownAt = ProcessInfo.processInfo.systemUptime
            }
        default:
            break
        }
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldReceive touch: UITouch
    ) -> Bool {
        guard gestureRecognizer === downPan else { return true }
        let y = touch.location(in: view).y
        return y > view.bounds.height - edgeBand()
    }

    func gestureRecognizer(
        _ gestureRecognizer: UIGestureRecognizer,
        shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
    ) -> Bool {
        gestureRecognizer !== downPan
    }

    func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
        guard let pan = gestureRecognizer as? UIPanGestureRecognizer, pan === downPan else {
            return true
        }
        refreshEdgeStrikes()
        if edgeDownStrikes >= 1 { return false }
        let t = pan.translation(in: view)
        let v = pan.velocity(in: view)
        return t.y > 6 || v.y > 60
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AdvancedHapticsPlugin())
        bridge?.registerPluginInstance(NativeAudioPlugin())
        CAPLog.print("⚡️ AdvancedHapticsPlugin registered")
        CAPLog.print("⚡️ NativeAudioPlugin registered")
    }
}
