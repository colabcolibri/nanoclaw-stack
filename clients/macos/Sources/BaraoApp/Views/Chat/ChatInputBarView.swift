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
    
    private var canSend: Bool {
        !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && !isSending
    }
    
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
            
            if isRecording {
                recordingHUD
            } else {
                inputRow
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(.bar)
    }
    
    private var inputRow: some View {
        HStack(alignment: .bottom, spacing: 10) {
            HStack(alignment: .bottom, spacing: 8) {
                if isDictating {
                    Circle()
                        .fill(Color.red)
                        .frame(width: 7, height: 7)
                        .padding(.bottom, 10)
                }
                
                ZStack(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(isDictating ? "Ouvindo..." : "Mensagem ao Barão…")
                            .font(.system(size: 14))
                            .foregroundStyle(Color(nsColor: .placeholderTextColor))
                            .padding(.top, 8)
                            .allowsHitTesting(false)
                    }
                    
                    ChatInputTextView(
                        text: $text,
                        isDictating: isDictating,
                        minHeight: 22,
                        maxHeight: 110,
                        dynamicHeight: $inputHeight,
                        onCommit: {
                            if isDictating { onToggleDictation() }
                            onSend()
                        }
                    )
                    .frame(height: inputHeight)
                }
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                
                Button(action: onToggleDictation) {
                    Image(systemName: isDictating ? "mic.fill" : "mic")
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(isDictating ? .white : .secondary)
                        .frame(width: 30, height: 30)
                        .background(isDictating ? Color.red : Color.clear, in: Circle())
                }
                .buttonStyle(.plain)
                .disabled(isSending)
                .help(isDictating ? "Parar ditado" : "Ditado por voz")
                .padding(.trailing, 4)
                .padding(.bottom, 2)
            }
            .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Color.primary.opacity(0.08), lineWidth: 1)
            )
            
            Button(action: sendTapped) {
                Image(systemName: "arrow.up")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(width: 34, height: 34)
                    .background(canSend ? Color.accentColor : Color.secondary.opacity(0.35), in: Circle())
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
            .help("Enviar (Enter)")
            .animation(.easeOut(duration: 0.15), value: canSend)
        }
    }
    
    private var recordingHUD: some View {
        HStack(spacing: 12) {
            Button(action: onCancelRecording) {
                Image(systemName: "xmark")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(.red)
                    .frame(width: 32, height: 32)
                    .background(Color.red.opacity(0.12), in: Circle())
            }
            .buttonStyle(.plain)
            .help("Cancelar gravação")
            
            AudioWaveformView(audioLevel: audioLevel)
            
            Text("Gravando…")
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.red)
            
            Spacer()
            
            Button(action: onStopRecording) {
                HStack(spacing: 6) {
                    Image(systemName: "arrow.up")
                    Text("Enviar")
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.red, in: Capsule())
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 4)
    }
    
    private func sendTapped() {
        if isDictating { onToggleDictation() }
        onSend()
    }
}
