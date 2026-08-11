import Foundation
import Capacitor
import AVFoundation

// WKWebView can silently reset AVAudioSession to an ambient category (which
// respects the hardware mute switch) once it spins up its own audio engine
// for the first Web Audio playback. Re-asserting .playback from the JS side
// right as the user taps Start, before WebKit gets a chance to do that,
// keeps playback audible even with the switch on silent.
@objc(AudioSessionPlugin)
public class AudioSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AudioSessionPlugin"
    public let jsName = "AudioSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "activate", returnType: CAPPluginReturnPromise)
    ]

    @objc func activate(_ call: CAPPluginCall) {
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
            call.resolve()
        } catch {
            call.reject("Failed to activate audio session: \(error.localizedDescription)")
        }
    }
}
