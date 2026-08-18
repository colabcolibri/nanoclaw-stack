import Foundation
import AVFoundation
import AppKit

public final class AudioPlaybackService: NSObject, AudioPlaybackProtocol, AVSpeechSynthesizerDelegate {
    public static let shared = AudioPlaybackService()
    
    private let synthesizer = AVSpeechSynthesizer()
    public var isSpeaking: Bool {
        synthesizer.isSpeaking
    }
    
    private override init() {
        super.init()
        synthesizer.delegate = self
    }
    
    public func speak(text: String) {
        stop()
        // Strip markdown and URLs for cleaner speech
        let cleanText = text
            .replacingOccurrences(of: "```[\\s\\S]*?```", with: "bloco de código", options: .regularExpression)
            .replacingOccurrences(of: "`.*?`", with: "", options: .regularExpression)
            .replacingOccurrences(of: "\\[(.*?)\\]\\(.*?\\)", with: "$1", options: .regularExpression)
            .replacingOccurrences(of: "[*#_~]", with: "", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        
        guard !cleanText.isEmpty else { return }
        
        let utterance = AVSpeechUtterance(string: cleanText)
        utterance.voice = AVSpeechSynthesisVoice(language: "pt-BR") ?? AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = AVSpeechUtteranceDefaultSpeechRate * 1.05
        utterance.pitchMultiplier = 1.0
        
        synthesizer.speak(utterance)
    }
    
    public func stop() {
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }
    
    public func playNotificationSound() {
        NSSound(named: "Glass")?.play()
    }
}
