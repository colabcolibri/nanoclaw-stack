import SwiftUI

public struct ChatInputBarView: View {
    @Binding public var text: String
    public let isSending: Bool
    public let isRecording: Bool
    public let audioLevel: Float
    public let onSend: () -> Void
    public let onStartRecording: () -> Void
    public let onStopRecording: () -> Void
    public let onCancelRecording: () -> Void
    
    public init(
        text: Binding<String>,
        isSending: Bool,
        isRecording: Bool,
        audioLevel: Float,
        onSend: @escaping () -> Void,
        onStartRecording: @escaping () -> Void,
        onStopRecording: @escaping () -> Void,
        onCancelRecording: @escaping () -> Void
    ) {
        self._text = text
        self.isSending = isSending
        self.isRecording = isRecording
        self.audioLevel = audioLevel
        self.onSend = onSend
        self.onStartRecording = onStartRecording
        self.onStopRecording = onStopRecording
        self.onCancelRecording = onCancelRecording
    }
    
    public var body: some View {
        VStack(spacing: 0) {
            Divider()
            
            HStack(alignment: .center, spacing: 10) {
                if isRecording {
                    // Recording HUD
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
                        
                        Text("Gravando...")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundColor(.red)
                        
                        Spacer()
                        
                        Button(action: onStopRecording) {
                            HStack(spacing: 6) {
                                Image(systemName: "arrow.up.circle.fill")
                                Text("Enviar Voz")
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
                    // Standard Text Input
                    TextField("Envie uma mensagem ao Barão... (Pressione Return)", text: $text, axis: .vertical)
                        .textFieldStyle(.plain)
                        .font(.system(size: 14))
                        .lineLimit(1...5)
                        .onSubmit {
                            if !NSEvent.modifierFlags.contains(.shift) {
                                onSend()
                            }
                        }
                    
                    // Voice Mic Button
                    Button(action: onStartRecording) {
                        Image(systemName: "mic.fill")
                            .font(.system(size: 15))
                            .foregroundColor(.secondary)
                            .frame(width: 30, height: 30)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                    .disabled(isSending)
                    .help("Gravar áudio (Push to talk)")
                    
                    // Send Button
                    Button(action: onSend) {
                        Image(systemName: "arrow.up.circle.fill")
                            .font(.system(size: 26))
                            .foregroundColor(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending ? .secondary.opacity(0.4) : .accentColor)
                    }
                    .buttonStyle(.plain)
                    .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
                    .keyboardShortcut(.return, modifiers: [])
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))
        }
    }
}
