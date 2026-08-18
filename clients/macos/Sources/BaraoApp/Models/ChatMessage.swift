import Foundation

/// Represents a single message in the chat thread.
public struct ChatMessage: Identifiable, Hashable, Codable {
    public let id: String
    public let role: Role
    public var text: String
    public let timestamp: Date
    public var isAudio: Bool
    public var isSending: Bool
    public var error: String?
    
    public enum Role: String, Codable, Hashable {
        case user
        case assistant
    }
    
    public init(
        id: String = UUID().uuidString,
        role: Role,
        text: String,
        timestamp: Date = Date(),
        isAudio: Bool = false,
        isSending: Bool = false,
        error: String? = nil
    ) {
        self.id = id
        self.role = role
        self.text = text
        self.timestamp = timestamp
        self.isAudio = isAudio
        self.isSending = isSending
        self.error = error
    }
}
