import Foundation

/// Mirrors `nanoclaw/src/conversations/thread-selection.ts`.
enum ThreadSelectionResolver {
    static func pickDefault(from threads: [ChatThread]) -> String? {
        guard !threads.isEmpty else { return nil }
        let actives = threads.filter(\.isActive)
        if let newest = actives.max(by: { ($0.lastActiveDate ?? .distantPast) < ($1.lastActiveDate ?? .distantPast) }) {
            return newest.sessionId
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
