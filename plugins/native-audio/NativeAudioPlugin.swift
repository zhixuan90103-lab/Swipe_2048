import AVFoundation
import Capacitor
import UIKit

@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioPlugin"
    public let jsName = "NativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preloadCatalog", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "flushSfx", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setMasterVolume", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resume", returnType: CAPPluginReturnPromise),
    ]

    private let engine = AVAudioEngine()
    private let mixer = AVAudioMixerNode()
    private var pool: [AVAudioPlayerNode] = []
    private var buffers: [String: AVAudioPCMBuffer] = [:]
    private var maxVoices: [String: Int] = [:]
    private var lastPlayed: [String: CFTimeInterval] = [:]
    private var cooldownMs: [String: Double] = [:]
    private var active: [AVAudioPlayerNode: String] = [:]
    private var started = false
    private let poolSize = 12
    private let queue = DispatchQueue(label: "native-audio.sfx")

    override public func load() {
        configureSession()
        engine.attach(mixer)
        engine.connect(mixer, to: engine.mainMixerNode, format: nil)
        for _ in 0 ..< poolSize {
            let node = AVAudioPlayerNode()
            engine.attach(node)
            engine.connect(node, to: mixer, format: nil)
            pool.append(node)
        }
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onResign),
            name: UIApplication.willResignActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(onRoute),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    @objc func preloadCatalog(_ call: CAPPluginCall) {
        guard let items = call.getArray("items", JSObject.self) else {
            call.resolve()
            return
        }
        queue.async {
            self.startEngine()
            let format = self.mixer.outputFormat(forBus: 0)
            for item in items {
                guard let id = item["id"] as? String, let path = item["path"] as? String else { continue }
                self.maxVoices[id] = (item["maxVoices"] as? NSNumber)?.intValue ?? 1
                self.cooldownMs[id] = (item["cooldownMs"] as? NSNumber)?.doubleValue ?? 0
                if let url = self.resolveWav(path),
                   let file = try? AVAudioFile(forReading: url),
                   let buf = self.convert(file: file, to: format)
                {
                    self.buffers[id] = buf
                }
            }
            call.resolve()
        }
    }

    @objc func flushSfx(_ call: CAPPluginCall) {
        let events = call.getArray("events", JSObject.self) ?? []
        call.resolve()
        queue.async {
            self.startEngine()
            let now = CACurrentMediaTime()
            let piano = events.contains { ev in
                ((ev["id"] as? String) ?? "").contains("_merge_")
            }
            if piano {
                for (node, id) in self.active {
                    if id.contains("_merge_") {
                        node.stop()
                        self.active.removeValue(forKey: node)
                    }
                }
            }
            for ev in events {
                guard let id = ev["id"] as? String, let buf = self.buffers[id] else { continue }
                let cd = (self.cooldownMs[id] ?? 0) / 1000.0
                if now - (self.lastPlayed[id] ?? -1e9) < cd { continue }
                let playing = self.active.values.filter { $0 == id }.count
                if playing >= (self.maxVoices[id] ?? 1) { continue }
                guard let node = self.idleNode() else { continue }
                let vol = (ev["volume"] as? NSNumber)?.floatValue ?? 1
                let rate = (ev["rate"] as? NSNumber)?.floatValue ?? 1
                node.volume = max(0, min(1, vol))
                if #available(iOS 17.0, *) {
                    node.rate = max(0.5, min(1.8, rate))
                }
                self.active[node] = id
                self.lastPlayed[id] = now
                node.scheduleBuffer(buf, completionHandler: {
                    self.queue.async {
                        self.active.removeValue(forKey: node)
                    }
                })
                if !node.isPlaying { node.play() }
            }
        }
    }

    @objc func setMasterVolume(_ call: CAPPluginCall) {
        let v = call.getFloat("volume") ?? 1
        mixer.outputVolume = max(0, min(1, v))
        call.resolve()
    }

    @objc func stopAll(_ call: CAPPluginCall) {
        queue.async {
            for n in self.pool {
                n.stop()
            }
            self.active.removeAll()
            self.engine.pause()
            call.resolve()
        }
    }

    @objc func resume(_ call: CAPPluginCall) {
        configureSession()
        startEngine()
        call.resolve()
    }

    @objc private func onResign() {
        queue.async {
            for n in self.pool { n.stop() }
            self.active.removeAll()
            self.engine.pause()
        }
    }

    @objc private func onActive() {
        configureSession()
        startEngine()
    }

    @objc private func onRoute() {
        configureSession()
        startEngine()
    }

    private func configureSession() {
        let s = AVAudioSession.sharedInstance()
        do {
            try s.setCategory(.ambient, options: [.mixWithOthers, .duckOthers])
            try s.setActive(true, options: [])
        } catch {
            CAPLog.print("NativeAudio session: \(error)")
        }
    }

    private func startEngine() {
        if engine.isRunning { return }
        do {
            try engine.start()
            started = true
        } catch {
            CAPLog.print("NativeAudio engine: \(error)")
        }
    }

    private func idleNode() -> AVAudioPlayerNode? {
        pool.first { active[$0] == nil }
    }

    private func resolveWav(_ path: String) -> URL? {
        let rel = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let name = (rel as NSString).deletingPathExtension
        let ext = (rel as NSString).pathExtension
        let dir = (name as NSString).deletingLastPathComponent
        let base = (name as NSString).lastPathComponent
        if let url = Bundle.main.url(forResource: base, withExtension: ext, subdirectory: "public/\(dir)") {
            return url
        }
        if let root = Bundle.main.resourceURL {
            let a = root.appendingPathComponent("public").appendingPathComponent(rel)
            if FileManager.default.fileExists(atPath: a.path) { return a }
            let b = root.appendingPathComponent(rel)
            if FileManager.default.fileExists(atPath: b.path) { return b }
        }
        return nil
    }

    private func convert(file: AVAudioFile, to format: AVAudioFormat) -> AVAudioPCMBuffer? {
        guard let src = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: AVAudioFrameCount(file.length)) else {
            return nil
        }
        do { try file.read(into: src) } catch { return nil }
        if src.format == format { return src }
        guard let converter = AVAudioConverter(from: src.format, to: format),
              let dst = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(Double(src.frameLength) * format.sampleRate / src.format.sampleRate) + 32)
        else { return nil }
        var error: NSError?
        var provided = false
        let inputBlock: AVAudioConverterInputBlock = { _, outStatus in
            if provided {
                outStatus.pointee = .noDataNow
                return nil
            }
            provided = true
            outStatus.pointee = .haveData
            return src
        }
        converter.convert(to: dst, error: &error, withInputFrom: inputBlock)
        return error == nil ? dst : nil
    }
}
