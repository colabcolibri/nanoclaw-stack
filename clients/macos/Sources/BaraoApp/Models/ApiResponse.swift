import Foundation

public struct PromptResponse: Codable {
    public let success: Bool?
    public let reply: String?
    public let timestamp: String?
    public let sessionId: String?
    public let error: String?
}

public struct ResetResponse: Codable {
    public let success: Bool?
    public let message: String?
    public let sessionId: String?
    public let error: String?
}

public struct AudioResponse: Codable {
    public let success: Bool?
    public let transcription: String?
    public let reply: String?
    public let timestamp: String?
    public let sessionId: String?
    public let error: String?
}

public struct HistoryMessageDto: Codable {
    public let id: String?
    public let role: String
    public let text: String
    public let timestamp: String
}

public struct HistoryResponse: Codable {
    public let success: Bool?
    public let messages: [HistoryMessageDto]?
    public let error: String?
}

public struct ThreadsResponse: Codable {
    public let success: Bool?
    public let threads: [ChatThread]?
    public let error: String?
}

public struct VerifyResponse: Codable {
    public let success: Bool?
    public let message: String?
    public let folder: String?
    public let error: String?
}
