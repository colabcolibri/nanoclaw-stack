import SwiftUI

public struct ChatView: View {
    @ObservedObject public var viewModel: ChatViewModel
    
    public init(viewModel: ChatViewModel) {
        self.viewModel = viewModel
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            if viewModel.messages.isEmpty {
                EmptyStateView { prompt in
                    viewModel.inputText = prompt
                    viewModel.sendMessage()
                }
            } else {
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 8) {
                            // "Ver mais anteriores" Header Button
                            if viewModel.hasMoreHistory {
                                Button(action: {
                                    viewModel.loadMoreHistory()
                                }) {
                                    HStack(spacing: 6) {
                                        if viewModel.isLoadingMore {
                                            ProgressView()
                                                .scaleEffect(0.6)
                                                .frame(width: 14, height: 14)
                                        } else {
                                            Image(systemName: "arrow.up.circle")
                                                .font(.system(size: 12))
                                        }
                                        Text(viewModel.isLoadingMore ? "Carregando mensagens..." : "Ver mensagens anteriores (+25)")
                                            .font(.system(size: 11, weight: .medium))
                                    }
                                    .foregroundColor(.secondary)
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 6)
                                    .background(Color(nsColor: .controlBackgroundColor))
                                    .cornerRadius(12)
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12)
                                            .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                                .padding(.top, 6)
                                .disabled(viewModel.isLoadingMore)
                            }
                            
                            ForEach(viewModel.messages) { message in
                                ChatMessageBubbleView(message: message) { text in
                                    viewModel.speakMessage(text)
                                }
                                .id(message.id)
                            }
                            
                            // Bottom Anchor View to ensure scroll always starts at bottom
                            Color.clear
                                .frame(height: 1)
                                .id("bottom-anchor")
                        }
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
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
}
