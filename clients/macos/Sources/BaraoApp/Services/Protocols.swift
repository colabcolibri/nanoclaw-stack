import Foundation
import Combine

/// Protocol for network interactions adhering to Single Responsibility & Dependency Inversion.
public protocol ApiClientProtocol {
    func verifyConnection(config: AppConfig) async throws -> Bool
    func sendPrompt(_ prompt: String, config: AppConfig, sessionId: String?) async throws -> PromptResponse
    func sendAudio(fileUrl: URL, config: AppConfig, sessionId: String?) async throws -> AudioResponse
    func fetchThreads(config: AppConfig, limit: Int) async throws -> [ChatThread]
    func fetchHistory(config: AppConfig, limit: Int, sessionId: String?) async throws -> [ChatMessage]
    func beginNewConversation(config: AppConfig, mode: ConversationResetMode) async throws -> ResetResponse
}

/// Protocol for secure persistent storage.
public protocol StorageServiceProtocol {
    func loadConfig() -> AppConfig
    func saveConfig(_ config: AppConfig)
    func getApiKey() -> String?
    func saveApiKey(_ key: String)
}

/// Protocol for microphone audio recording.
public protocol AudioRecordingProtocol: AnyObject {
    var isRecording: Bool { get }
    var audioLevelPublisher: AnyPublisher<Float, Never> { get }
    func startRecording() throws -> URL
    func stopRecording() -> URL?
    func cancelRecording()
}

/// Protocol for text-to-speech and audio output.
public protocol AudioPlaybackProtocol: AnyObject {
    var isSpeaking: Bool { get }
    func speak(text: String)
    func stop()
    func playNotificationSound()
}
