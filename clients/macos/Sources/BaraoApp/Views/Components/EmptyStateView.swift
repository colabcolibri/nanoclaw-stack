import SwiftUI

public struct EmptyStateView: View {
    public let onSelectPrompt: (String) -> Void
    
    public init(onSelectPrompt: @escaping (String) -> Void) {
        self.onSelectPrompt = onSelectPrompt
    }
    
    private let suggestions = [
        "📅 Quais são meus compromissos de hoje?",
        "✉️ Resuma meus e-mails não lidos prioritários.",
        "🛍️ Como estão as vendas da Yampi hoje?",
        "📝 Crie uma nova nota no Notion com minhas tarefas."
    ]
    
    public var body: some View {
        VStack(spacing: 18) {
            Spacer()
            
            ZStack {
                Circle()
                    .fill(Color.accentColor.opacity(0.12))
                    .frame(width: 80, height: 80)
                Image(systemName: "sparkles")
                    .font(.system(size: 36, weight: .semibold))
                    .foregroundColor(.accentColor)
            }
            
            VStack(spacing: 6) {
                Text("Olá, Sérgio!")
                    .font(.title2)
                    .fontWeight(.bold)
                Text("Em que posso te ajudar agora?")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            VStack(spacing: 8) {
                ForEach(suggestions, id: \.self) { prompt in
                    Button(action: { onSelectPrompt(prompt) }) {
                        Text(prompt)
                            .font(.callout)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 10)
                            .frame(maxWidth: 380, alignment: .leading)
                            .background(Color(nsColor: .controlBackgroundColor))
                            .cornerRadius(10)
                            .overlay(
                                RoundedRectangle(cornerRadius: 10)
                                    .stroke(Color.secondary.opacity(0.15), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.top, 10)
            
            Spacer()
        }
        .padding()
    }
}
