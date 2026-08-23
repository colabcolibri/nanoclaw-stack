import SwiftUI

public struct ChatView: View {
    @ObservedObject public var viewModel: ChatViewModel
    
    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }
    
    public var body: some View {
        ZStack {
            if viewModel.isLoadingMessages && viewModel.messages.isEmpty {
                ProgressView()
            } else if viewModel.messages.isEmpty {
                EmptyStateView(assistantName: viewModel.assistantName) { prompt in
                    guard viewModel.canSendMessages else { return }
                    viewModel.inputText = prompt
                    viewModel.sendMessage()
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: AppConstants.ChatDesign.messageSpacing) {
                            if viewModel.hasMoreHistory {
                                loadMoreButton
                            }
                            
                            ForEach(viewModel.messages) { message in
                                ChatMessageBubbleView(message: message) { text in
                                    viewModel.speakMessage(text)
                                }
                                .id(message.id)
                            }
                            
                            Color.clear
                                .frame(height: 8)
                                .id("bottom-anchor")
                        }
                        .padding(.vertical, 16)
                        .frame(maxWidth: 720)
                        .frame(maxWidth: .infinity)
                    }
                    .onAppear {
                        scrollToBottom(proxy, animated: false)
                    }
                    .onChange(of: viewModel.messages.count) { _ in
                        if !viewModel.isLoadingMore {
                            scrollToBottom(proxy, animated: true)
                        }
                    }
                    .onChange(of: viewModel.selectedSessionId) { _ in
                        scrollToBottom(proxy, animated: false)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppConstants.Colors.chatCanvas.opacity(0.35))
        .safeAreaInset(edge: .bottom, spacing: 0) {
            VStack(spacing: 0) {
                if !viewModel.canSendMessages {
                    archivedBanner
                }
                ChatInputBarView(
                    text: $viewModel.inputText,
                    isSending: viewModel.isSending,
                    isRecording: viewModel.isRecording,
                    isDictating: viewModel.isDictating,
                    audioLevel: viewModel.audioLevel,
                    isEnabled: viewModel.canSendMessages,
                    onSend: viewModel.sendMessage,
                    onToggleDictation: viewModel.toggleLiveDictation,
                    onStartRecording: viewModel.startVoiceRecording,
                    onStopRecording: viewModel.stopAndSendVoiceRecording,
                    onCancelRecording: viewModel.cancelVoiceRecording
                )
            }
        }
    }
    
    private var archivedBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "archivebox")
                .font(.system(size: 11))
            Text("Conversa arquivada — leitura apenas.")
                .font(.system(size: 11, weight: .medium))
            Spacer()
            Button("Nova conversa") {
                viewModel.startNewConversation()
            }
            .font(.system(size: 11, weight: .semibold))
            .buttonStyle(.borderedProminent)
            .controlSize(.small)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 8)
        .background(Color.orange.opacity(0.12))
    }
    
    private func scrollToBottom(_ proxy: ScrollViewProxy, animated: Bool) {
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
            if animated {
                withAnimation(.easeOut(duration: 0.25)) {
                    proxy.scrollTo("bottom-anchor", anchor: .bottom)
                }
            } else {
                proxy.scrollTo("bottom-anchor", anchor: .bottom)
            }
        }
    }
    
    private var loadMoreButton: some View {
        Button(action: { viewModel.loadMoreHistory() }) {
            HStack(spacing: 6) {
                if viewModel.isLoadingMore {
                    ProgressView()
                        .scaleEffect(0.6)
                        .frame(width: 14, height: 14)
                } else {
                    Image(systemName: "arrow.up.circle")
                        .font(.system(size: 12))
                }
                Text(viewModel.isLoadingMore ? "Carregando…" : "Mensagens anteriores")
                    .font(.system(size: 11, weight: .medium))
            }
            .foregroundStyle(.secondary)
            .padding(.horizontal, 14)
            .padding(.vertical, 7)
            .background(.ultraThinMaterial, in: Capsule())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isLoadingMore)
    }
}
