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

    /// 底边系统手势（Home / 多任务）要滑两次才生效，第一次优先给游戏。
    /// 不要同时 prefersHomeIndicatorAutoHidden，否则 defer 会失效。
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        .bottom
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(AdvancedHapticsPlugin())
        bridge?.registerPluginInstance(NativeAudioPlugin())
        CAPLog.print("⚡️ AdvancedHapticsPlugin registered")
        CAPLog.print("⚡️ NativeAudioPlugin registered")
    }
}
