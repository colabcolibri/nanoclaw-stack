import SwiftUI

public struct ThreadSidebarView: View {
    public let threads: [ChatThread]
    public let selectedSessionId: String?
    public let isLoading: Bool
    public let onSelect: (String) -> Void
    public let onNewConversation: () -> Void
    public let onRefresh: () -> Void

    @State private var searchText = ""

    public init(
        threads: [ChatThread],
        selectedSessionId: String?,
        isLoading: Bool,
        onSelect: @escaping (String) -> Void,
        onNewConversation: @escaping () -> Void,
        onRefresh: @escaping () -> Void
    ) {
        self.threads = threads
        self.selectedSessionId = selectedSessionId
        self.isLoading = isLoading
        self.onSelect = onSelect
        self.onNewConversation = onNewConversation
        self.onRefresh = onRefresh
    }

    private var filteredThreads: [ChatThread] {
        let q = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !q.isEmpty else { return threads }
        return threads.filter { thread in
            [
                thread.displayTitle,
                thread.threadId,
                thread.sessionId,
                thread.lastPreview,
                thread.lastSenderName,
            ]
                .compactMap { $0 }
                .joined(separator: " ")
                .lowercased()
                .contains(q)
        }
    }

    private var activeThreads: [ChatThread] {
        filteredThreads.filter(\.isActive)
    }

    private var archivedThreads: [ChatThread] {
        filteredThreads.filter { !$0.isActive }
    }

    public var body: some View {
        VStack(spacing: 0) {
            HStack {
                Text("Conversas")
                    .font(.system(size: 13, weight: .semibold))
                Spacer()
                Button(action: onRefresh) {
                    Image(systemName: "arrow.clockwise")
                        .font(.system(size: 12, weight: .medium))
                }
                .buttonStyle(.plain)
                .help("Atualizar lista")
                .disabled(isLoading)
            }
            .padding(.horizontal, 12)
            .padding(.top, 12)
            .padding(.bottom, 8)

            Button(action: onNewConversation) {
                HStack(spacing: 6) {
                    Image(systemName: "plus.message")
                    Text("Nova conversa")
                }
                .font(.system(size: 12, weight: .semibold))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
            .padding(.horizontal, 12)
            .padding(.bottom, 8)

            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
                TextField("Buscar conversas", text: $searchText)
                    .textFieldStyle(.plain)
                    .font(.system(size: 12))
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 7)
            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
            .padding(.horizontal, 12)
            .padding(.bottom, 8)

            Divider()

            if isLoading && threads.isEmpty {
                Spacer()
                ProgressView()
                Spacer()
            } else if filteredThreads.isEmpty {
                Spacer()
                Text("Sem conversas")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        if !activeThreads.isEmpty {
                            sectionHeader("Ativas")
                            ForEach(activeThreads) { thread in
                                threadRow(thread)
                            }
                        }
                        if !archivedThreads.isEmpty {
                            sectionHeader("Arquivadas")
                            ForEach(archivedThreads) { thread in
                                threadRow(thread)
                            }
                        }
                    }
                    .padding(.vertical, 6)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.35))
    }

    private func sectionHeader(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 12)
            .padding(.top, 8)
            .padding(.bottom, 4)
    }

    private func threadRow(_ thread: ChatThread) -> some View {
        let isSelected = selectedSessionId == thread.sessionId
        return Button {
            onSelect(thread.sessionId)
        } label: {
            HStack(alignment: .top, spacing: 8) {
                Circle()
                    .fill(thread.isActive ? Color.accentColor : Color.secondary.opacity(0.4))
                    .frame(width: 7, height: 7)
                    .padding(.top, 5)

                VStack(alignment: .leading, spacing: 3) {
                    HStack {
                        Text(thread.displayTitle)
                            .font(.system(size: 12, weight: isSelected ? .semibold : .medium))
                            .lineLimit(2)
                            .multilineTextAlignment(.leading)
                        Spacer(minLength: 4)
                        if !thread.relativeTime.isEmpty {
                            Text(thread.relativeTime)
                                .font(.system(size: 10))
                                .foregroundStyle(.tertiary)
                        }
                    }
                    HStack(spacing: 6) {
                        if !thread.isActive {
                            Text("Arquivada")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundStyle(.secondary)
                        }
                        if let count = thread.messageCount, count > 0 {
                            Text("\(count) mensagens")
                                .font(.system(size: 10))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                isSelected ? Color.accentColor.opacity(thread.isActive ? 0.14 : 0.08) : Color.clear,
                in: RoundedRectangle(cornerRadius: 8, style: .continuous)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 6)
        .opacity(thread.isActive ? 1 : 0.82)
    }
}
