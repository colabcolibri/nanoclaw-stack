import SwiftUI

public struct EmptyStateView: View {
    public let assistantName: String
    public let onSelectPrompt: (String) -> Void
    
    public init(assistantName: String = AppConstants.appName, onSelectPrompt: @escaping (String) -> Void) {
        self.assistantName = assistantName
        self.onSelectPrompt = onSelectPrompt
    }
    
    private let suggestions: [(icon: String, text: String)] = [
        ("calendar", "Quais são meus compromissos de hoje?"),
        ("envelope", "Resuma meus e-mails não lidos prioritários."),
        ("cart", "Como estão as vendas da Yampi hoje?"),
        ("note.text", "Crie uma nota no Notion com minhas tarefas.")
    ]
    
    public var body: some View {
        VStack(spacing: 22) {
            Spacer()
            
            RobotAvatarView(size: 64)
                .shadow(color: .black.opacity(0.08), radius: 12, y: 4)
            
            VStack(spacing: 8) {
                Text("Olá! Eu sou o \(assistantName).")
                    .font(.title3)
                    .fontWeight(.semibold)
                    .multilineTextAlignment(.center)
                Text("Escolha uma sugestão ou escreva abaixo.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            
            VStack(spacing: 8) {
                ForEach(suggestions, id: \.text) { item in
                    Button(action: { onSelectPrompt(item.text) }) {
                        HStack(spacing: 12) {
                            Image(systemName: item.icon)
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color.accentColor)
                                .frame(width: 28, height: 28)
                                .background(Color.accentColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            
                            Text(item.text)
                                .font(.system(size: 13))
                                .foregroundStyle(.primary)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                            
                            Image(systemName: "arrow.up.right")
                                .font(.system(size: 10, weight: .semibold))
                                .foregroundStyle(.tertiary)
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .background(Color(nsColor: .controlBackgroundColor), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(Color.primary.opacity(0.06), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .frame(maxWidth: 400)
            .padding(.horizontal, 20)
            
            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppConstants.Colors.chatCanvas.opacity(0.45))
        .padding()
    }
}
