import Foundation

/// Coordinates client state after any server turn (prompt, reset, audio).
enum ConversationSessionSync {
    static func preferredSessionId(from response: String?, current: String?) -> String? {
        guard let trimmed = response?.trimmingCharacters(in: .whitespacesAndNewlines), !trimmed.isEmpty else {
            return current
        }
        return trimmed
    }
}
