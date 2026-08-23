import Foundation

/// Server-side conversation thread (session) for the macOS channel.
public struct ChatThread: Identifiable, Codable, Equatable {
    public let sessionId: String
    public let agentGroupId: String?
    public let threadId: String?
    public let channel: String
    public let status: String
    public let conversationId: String?
    public let lastActiveAt: String?
    public let messageCount: Int?
    public let lastPreview: String?
    public let lastSenderName: String?

    public var id: String { sessionId }

    public var isActive: Bool { status == "active" }

    public var displayTitle: String {
        if let preview = lastPreview?.trimmingCharacters(in: .whitespacesAndNewlines), !preview.isEmpty {
            return preview
        }
        if let threadId {
            let colon = threadId.firstIndex(of: ":")
            if let colon, colon < threadId.index(before: threadId.endIndex) {
                return String(threadId[threadId.index(after: colon)...])
            }
            return threadId
        }
        return sessionId.replacingOccurrences(of: "sess-", with: "").prefix(12).description
    }

    public var relativeTime: String {
        guard let lastActiveAt, let date = ChatThread.parseDate(lastActiveAt) else { return "" }
        let diff = Date().timeIntervalSince(date)
        let minutes = Int(diff / 60)
        let hours = Int(diff / 3600)
        let days = Int(diff / 86400)
        if minutes < 1 { return "agora" }
        if minutes < 60 { return "\(minutes) min" }
        if hours < 24 { return "\(hours)h" }
        if days < 7 { return "\(days)d" }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "pt_BR")
        formatter.dateFormat = "dd MMM"
        return formatter.string(from: date)
    }

    private static func parseDate(_ iso: String) -> Date? {
        let f1 = ISO8601DateFormatter()
        f1.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let d = f1.date(from: iso) { return d }
        let f2 = ISO8601DateFormatter()
        return f2.date(from: iso)
    }
}
