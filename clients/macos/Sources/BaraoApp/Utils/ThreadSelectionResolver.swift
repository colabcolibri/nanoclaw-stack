import Foundation

/// Mirrors `nanoclaw/src/conversations/thread-selection.ts`.
enum ThreadSelectionResolver {
    static func pickDefault(from threads: [ChatThread]) -> String? {
        guard !threads.isEmpty else { return nil }
        if let active = threads.first(where: \.isActive) {
            return active.sessionId
        }
        return threads.first?.sessionId
    }

    /// Keep selection only when still active; otherwise follow the current active session.
    static func resolve(current: String?, in threads: [ChatThread]) -> String? {
        if let current,
           let selected = threads.first(where: { $0.sessionId == current }),
           selected.isActive {
            return current
        }
        return pickDefault(from: threads)
    }
}
