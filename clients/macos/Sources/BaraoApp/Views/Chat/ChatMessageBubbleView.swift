import SwiftUI
import AppKit

public struct ChatMessageBubbleView: View {
    public let message: ChatMessage
    public let onSpeak: (String) -> Void
    
    @State private var isHovering = false
    @State private var copied = false
    
    public init(message: ChatMessage, onSpeak: @escaping (String) -> Void) {
        self.message = message
        self.onSpeak = onSpeak
    }
    
    private var isUser: Bool {
        message.role == .user
    }
    
    public var body: some View {
        HStack(alignment: .bottom, spacing: 8) {
            if isUser {
                Spacer(minLength: 40)
            }
            
            if !isUser {
                Image(systemName: "crown.fill")
                    .font(.system(size: 14))
                    .foregroundColor(.accentColor)
                    .frame(width: 28, height: 28)
                    .background(Color.accentColor.opacity(0.15))
                    .clipShape(Circle())
            }
            
            VStack(alignment: isUser ? .trailing : .leading, spacing: 4) {
                HStack {
                    if message.isSending {
                        ProgressView()
                            .scaleEffect(0.6)
                            .frame(width: 14, height: 14)
                    }
                    
                    Text(message.text)
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                        .textSelection(.enabled)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(isUser ? Color.accentColor : Color(nsColor: .controlBackgroundColor))
                .cornerRadius(16)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(isUser ? Color.clear : Color.secondary.opacity(0.15), lineWidth: 1)
                )
                
                // Timestamp & Action buttons on hover
                HStack(spacing: 8) {
                    Text(message.timestamp, style: .time)
                        .font(.system(size: 10))
                        .foregroundColor(.secondary)
                    
                    if isHovering && !isUser && !message.isSending {
                        Button(action: {
                            NSPasteboard.general.clearContents()
                            NSPasteboard.general.setString(message.text, forType: .string)
                            copied = true
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { copied = false }
                        }) {
                            Image(systemName: copied ? "checkmark" : "doc.on.doc")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("Copiar resposta")
                        
                        Button(action: { onSpeak(message.text) }) {
                            Image(systemName: "speaker.wave.2")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .help("Ouvir resposta")
                    }
                }
                .padding(.horizontal, 4)
            }
            .onHover { isHovering = $0 }
            
            if isUser {
                Image(systemName: "person.crop.circle.fill")
                    .font(.system(size: 24))
                    .foregroundColor(.secondary)
            } else {
                Spacer(minLength: 40)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 4)
    }
}
