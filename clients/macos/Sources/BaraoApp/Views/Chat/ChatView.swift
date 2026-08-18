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
                        LazyVStack(spacing: 6) {
                            ForEach(viewModel.messages) { message in
                                ChatMessageBubbleView(message: message) { text in
                                    viewModel.speakMessage(text)
                                }
                                .id(message.id)
                            }
                        }
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .onChange(of: viewModel.messages.count) { _ in
                        if let last = viewModel.messages.last {
                            withAnimation(.easeOut(duration: 0.2)) {
                                proxy.scrollTo(last.id, anchor: .bottom)
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
