import SwiftUI

public struct ChatView: View {
    @ObservedObject public var viewModel: ChatViewModel
    
    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            if viewModel.messages.isEmpty {
                EmptyStateView(assistantName: viewModel.assistantName) { prompt in
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
                                .frame(height: 1)
                                .id("bottom-anchor")
                        }
                        .padding(.vertical, 16)
                        .frame(maxWidth: 720)
                        .frame(maxWidth: .infinity)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppConstants.Colors.chatCanvas.opacity(0.45))
                    .onAppear {
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                            proxy.scrollTo("bottom-anchor", anchor: .bottom)
                        }
                    }
                    .onChange(of: viewModel.messages.count) { _ in
                        if !viewModel.isLoadingMore {
                            withAnimation(.easeOut(duration: 0.25)) {
                                proxy.scrollTo("bottom-anchor", anchor: .bottom)
                            }
                        }
                    }
                }
            }
            
            ChatInputBarView(
                text: $viewModel.inputText,
                isSending: viewModel.isSending,
                isRecording: viewModel.isRecording,
                isDictating: viewModel.isDictating,
                audioLevel: viewModel.audioLevel,
                onSend: viewModel.sendMessage,
                onToggleDictation: viewModel.toggleLiveDictation,
                onStartRecording: viewModel.startVoiceRecording,
                onStopRecording: viewModel.stopAndSendVoiceRecording,
                onCancelRecording: viewModel.cancelVoiceRecording
            )
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
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
