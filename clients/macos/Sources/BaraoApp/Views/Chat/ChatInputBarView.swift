import SwiftUI

public struct ChatInputBarView: View {
    @Binding public var text: String
    public let isSending: Bool
    public let isRecording: Bool
    public let isDictating: Bool
    public let audioLevel: Float
    public let onSend: () -> Void
    public let onToggleDictation: () -> Void
    public let onStartRecording: () -> Void
    public let onStopRecording: () -> Void
    public let onCancelRecording: () -> Void
    
    @State private var inputHeight: CGFloat = 24
    
    public init(
        text: Binding<String>,
        isSending: Bool,
        isRecording: Bool,
        isDictating: Bool = false,
        audioLevel: Float,
        onSend: @escaping () -> Void,
        onToggleDictation: @escaping () -> Void,
        onStartRecording: @escaping () -> Void,
        onStopRecording: @escaping () -> Void,
        onCancelRecording: @escaping () -> Void
    ) {
        self._text = text
        self.isSending = isSending
        self.isRecording = isRecording
        self.isDictating = isDictating
        self.audioLevel = audioLevel
        self.onSend = onSend
        self.onToggleDictation = onToggleDictation
        self.onStartRecording = onStartRecording
        self.onStopRecording = onStopRecording
        self.onCancelRecording = onCancelRecording
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            Divider()
            
            HStack(alignment: .bottom, spacing: 10) {
                if isRecording {
                    // Raw Audio Recording HUD
                    HStack(spacing: 12) {
                        Button(action: onCancelRecording) {
                            Image(systemName: "trash.fill")
                                .font(.system(size: 14))
                                .foregroundColor(.red)
                                .frame(width: 32, height: 32)
                                .background(Color.red.opacity(0.12))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .help("Cancelar gravação")
                        
                        AudioWaveformView(audioLevel: audioLevel)
                        
                        Text("Gravando áudio...")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.red)
                        
                        Spacer()
                        
                        Button(action: onStopRecording) {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.up.circle.fill")
                                Text("Enviar")
                            }
                            .font(.system(size: 12, weight: .bold))
                            .foregroundColor(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color.red)
                            .cornerRadius(16)
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                } else {
                    // Multiline Text Input with Live Dictation & Auto-Sizing (up to 5 lines)
                    HStack(alignment: .center, spacing: 6) {
                        if isDictating {
                            Circle()
                                .fill(Color.red)
                                .frame(width: 8, height: 8)
                        }
                        
                        ZStack(alignment: .topLeading) {
                            if text.isEmpty {
                                Text(isDictating ? "Ouvindo sua voz em tempo real..." : "Envie uma mensagem ao Barão... (Shift+Enter para nova linha)")
                                    .font(.system(size: 14))
                                    .foregroundColor(Color(nsColor: .placeholderTextColor))
                                    .padding(.top, 2)
                                    .allowsHitTesting(false)
                            }
                            
                            ChatInputTextView(
                                text: $text,
                                isDictating: isDictating,
                                minHeight: 22,
                                maxHeight: 110,
                                dynamicHeight: $inputHeight,
                                onCommit: {
                                    if isDictating {
                                        onToggleDictation()
                                    }
                                    onSend()
                                }
                            )
                            .frame(height: inputHeight)
                        }
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Color(nsColor: .controlBackgroundColor))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.secondary.opacity(0.2), lineWidth: 1)
                    )
                    
                    // Live Speech Dictation Button
                    Button(action: onToggleDictation) {
                        Image(systemName: isDictating ? "mic.fill" : "mic")
                            .font(.system(size: 15))
                            .foregroundColor(isDictating ? .white : .secondary)
                            .frame(width: 32, height: 32)
                            .background(isDictating ? Color.red : Color(nsColor: .controlBackgroundColor))
                            .clipShape(Circle())
                            .shadow(color: isDictating ? Color.red.opacity(0.4) : Color.clear, radius: 4)
                    }
                    .buttonStyle(.plain)
                    .disabled(isSending)
                    .help(isDictating ? "Parar transcrição de voz" : "Falar por voz (Transcrição em tempo real)")
                    .padding(.bottom, 1)
                    
                    // Send Button
                    Button(action: {
                        if isDictating {
                            onToggleDictation()
                        }
                        onSend()
                    }) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 28))
                            .foregroundColor(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending ? .secondary.opacity(0.4) : .accentColor)
                    }
                    .buttonStyle(.plain)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                    .help("Enviar mensagem (Enter)")
                    .padding(.bottom, 2)
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))
        }
    }
}


