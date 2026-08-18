import Foundation
import Speech
import AVFoundation

public protocol LiveSpeechRecognitionProtocol: AnyObject {
    var isListening: Bool { get }
    func startDictation(
        onPartialText: @escaping (String) -> Void,
        onError: @escaping (Error) -> Void
    )
    func stopDictation()
}

public final class LiveSpeechRecognitionService: NSObject, LiveSpeechRecognitionProtocol, SFSpeechRecognizerDelegate {
    public static let shared = LiveSpeechRecognitionService()
    
    private var speechRecognizer: SFSpeechRecognizer?
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private let audioEngine = AVAudioEngine()
    
    public private(set) var isListening: Bool = false
    
    private override init() {
        super.init()
        self.speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "pt-BR")) ?? SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
        self.speechRecognizer?.delegate = self
    }
    
    public func requestAuthorization(completion: @escaping (Bool) -> Void) {
        SFSpeechRecognizer.requestAuthorization { status in
            DispatchQueue.main.async {
                completion(status == .authorized)
            }
        }
    }
    
    public func startDictation(
        onPartialText: @escaping (String) -> Void,
        onError: @escaping (Error) -> Void
    ) {
        guard !isListening else { return }
        
        // Ensure authorization
        SFSpeechRecognizer.requestAuthorization { [weak self] authStatus in
            guard let self = self else { return }
            guard authStatus == .authorized else {
                DispatchQueue.main.async {
                    onError(NSError(domain: "Speech", code: 1, userInfo: [NSLocalizedDescriptionKey: "Permissão de reconhecimento de fala negada nas Preferências do Sistema."]))
                }
                return
            }
            
            DispatchQueue.main.async {
                do {
                    try self.startAudioEngine(onPartialText: onPartialText)
                } catch {
                    onError(error)
                }
            }
        }
    }
    
    private func startAudioEngine(onPartialText: @escaping (String) -> Void) throws {
        // Cancel existing task
        recognitionTask?.cancel()
        recognitionTask = nil
        
        let inputNode = audioEngine.inputNode
        recognitionRequest = SFSpeechAudioBufferRecognitionRequest()
        
        guard let recognitionRequest = recognitionRequest else {
            throw NSError(domain: "Speech", code: 2, userInfo: [NSLocalizedDescriptionKey: "Falha ao inicializar requisição de fala."])
        }
        
        recognitionRequest.shouldReportPartialResults = true
        if #available(macOS 13.0, *) {
            recognitionRequest.addsPunctuation = true
        }
        
        recognitionTask = speechRecognizer?.recognitionTask(with: recognitionRequest) { result, error in
            if let result = result {
                let transcription = result.bestTranscription.formattedString
                DispatchQueue.main.async {
                    onPartialText(transcription)
                }
            }
            
            if error != nil || (result?.isFinal ?? false) {
                self.stopDictation()
            }
        }
        
        let recordingFormat = inputNode.outputFormat(forBus: 0)
        inputNode.removeTap(onBus: 0)
        inputNode.installTap(onBus: 0, bufferSize: 1024, format: recordingFormat) { [weak self] buffer, _ in
            self?.recognitionRequest?.append(buffer)
        }
        
        audioEngine.prepare()
        try audioEngine.start()
        isListening = true
    }
    
    public func stopDictation() {
        guard isListening else { return }
        audioEngine.stop()
        audioEngine.inputNode.removeTap(onBus: 0)
        recognitionRequest?.endAudio()
        recognitionRequest = nil
        recognitionTask?.cancel()
        recognitionTask = nil
        isListening = false
    }
}
