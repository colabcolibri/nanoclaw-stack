import Foundation
import AVFoundation
import Combine

public final class AudioRecordingService: NSObject, AudioRecordingProtocol, AVAudioRecorderDelegate {
    public static let shared = AudioRecordingService()
    
    private var audioRecorder: AVAudioRecorder?
    private var recordingUrl: URL?
    private var meteringTimer: Timer?
    private let audioLevelSubject = PassthroughSubject<Float, Never>()
    
    public var isRecording: Bool {
        audioRecorder?.isRecording ?? false
    }
    
    public var audioLevelPublisher: AnyPublisher<Float, Never> {
        audioLevelSubject.eraseToAnyPublisher()
    }
    
    private override init() {
        super.init()
    }
    
    public func startRecording() throws -> URL {
        let tempDir = FileManager.default.temporaryDirectory
        let fileUrl = tempDir.appendingPathComponent("barao_audio_\(UUID().uuidString).m4a")
        self.recordingUrl = fileUrl
        
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 16000.0,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue
        ]
        
        audioRecorder = try AVAudioRecorder(url: fileUrl, settings: settings)
        audioRecorder?.delegate = self
        audioRecorder?.isMeteringEnabled = true
        audioRecorder?.prepareToRecord()
        audioRecorder?.record()
        
        startMetering()
        return fileUrl
    }
    
    public func stopRecording() -> URL? {
        stopMetering()
        audioRecorder?.stop()
        audioRecorder = nil
        return recordingUrl
    }
    
    public func cancelRecording() {
        stopMetering()
        audioRecorder?.stop()
        audioRecorder = nil
        if let url = recordingUrl {
            try? FileManager.default.removeItem(at: url)
        }
        recordingUrl = nil
    }
    
    private func startMetering() {
        meteringTimer?.invalidate()
        meteringTimer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            guard let self = self, let recorder = self.audioRecorder, recorder.isRecording else { return }
            recorder.updateMeters()
            let power = recorder.averagePower(forChannel: 0) // -160 dB to 0 dB
            let linearLevel = max(0.0, min(1.0, (power + 50.0) / 50.0))
            self.audioLevelSubject.send(Float(linearLevel))
        }
    }
    
    private func stopMetering() {
        meteringTimer?.invalidate()
        meteringTimer = nil
        audioLevelSubject.send(0.0)
    }
}
