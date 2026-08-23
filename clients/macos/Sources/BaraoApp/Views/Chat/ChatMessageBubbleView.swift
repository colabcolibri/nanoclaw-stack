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

    private var showActions: Bool {
        !isUser && !message.isSending && message.error == nil
    }
    
    public var body: some View {
        HStack(alignment: .top, spacing: 10) {
            if isUser {
                Spacer(minLength: 56)
            }
            
            if !isUser {
                RobotAvatarView(size: 30)
                    .padding(.top, 18)
            }
            
            VStack(alignment: isUser ? .trailing : .leading, spacing: 6) {
                Text(isUser ? "Você" : AppConstants.appName)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.secondary)
                
                bubbleStack
                
                Text(message.timestamp, style: .time)
                    .font(.system(size: 10))
                    .foregroundStyle(.tertiary)
            }
            .frame(maxWidth: AppConstants.ChatDesign.bubbleMaxWidth, alignment: isUser ? .trailing : .leading)
            
            if !isUser {
                Spacer(minLength: 56)
            }
        }
        .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
        .padding(.horizontal, AppConstants.ChatDesign.horizontalPadding)
        .contentShape(Rectangle())
        .onHover { hovering in
            withAnimation(.easeOut(duration: 0.12)) {
                isHovering = hovering
            }
        }
    }
    
    @ViewBuilder
    private var bubbleStack: some View {
        ZStack(alignment: .bottomTrailing) {
            bubbleContent
                .background(bubbleBackground)
                .clipShape(RoundedRectangle(cornerRadius: AppConstants.ChatDesign.bubbleRadius, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: AppConstants.ChatDesign.bubbleRadius, style: .continuous)
                        .stroke(bubbleBorderColor, lineWidth: 1)
                )
                .shadow(color: .black.opacity(isUser ? 0.08 : 0.05), radius: 10, y: 3)
            
            if showActions {
                actionToolbar
                    .padding(8)
            }
        }
    }
    
    private var bubbleContent: some View {
        HStack(alignment: .top, spacing: 8) {
            if message.isSending {
                ProgressView()
                    .scaleEffect(0.65)
                    .frame(width: 16, height: 16)
                    .padding(.top, 2)
            }
            
            MarkdownContentView(text: message.text, isUser: isUser)
                .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 11)
        .padding(.bottom, showActions && isHovering ? 4 : 0)
    }
    
    private var actionToolbar: some View {
        HStack(spacing: 2) {
            actionButton(
                icon: copied ? "checkmark" : "doc.on.doc",
                label: "Copiar resposta",
                action: copyMessage
            )
            actionButton(
                icon: "speaker.wave.2",
                label: "Ouvir resposta",
                action: { onSpeak(message.text) }
            )
        }
        .padding(.horizontal, 4)
        .padding(.vertical, 3)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.primary.opacity(0.08), lineWidth: 1))
        .opacity(isHovering || copied ? 1 : 0)
        .animation(.easeOut(duration: 0.15), value: isHovering)
        .animation(.easeOut(duration: 0.15), value: copied)
        .allowsHitTesting(isHovering || copied)
    }
    
    private func actionButton(icon: String, label: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(width: 28, height: 28)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .help(label)
    }
    
    private func copyMessage() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(message.text, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            copied = false
        }
    }
    
    @ViewBuilder
    private var bubbleBackground: some View {
        if message.error != nil {
            Color.red.opacity(0.1)
        } else if isUser {
            AppConstants.ChatDesign.userBubbleGradient
        } else {
            Color(nsColor: .controlBackgroundColor)
        }
    }
    
    private var bubbleBorderColor: Color {
        if message.error != nil {
            return Color.red.opacity(0.35)
        }
        return isUser ? Color.clear : Color.primary.opacity(0.06)
    }
}
