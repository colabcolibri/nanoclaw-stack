import SwiftUI

public struct StatusIndicatorView: View {
    public let isConnected: Bool
    public let isChecking: Bool
    
    public init(isConnected: Bool, isChecking: Bool) {
        self.isConnected = isConnected
        self.isChecking = isChecking
    }
    
    public var body: some View {
        HStack(spacing: 6) {
            if isChecking {
                ProgressView()
                    .scaleEffect(0.5)
                    .frame(width: 10, height: 10)
                Text("Conectando...")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            } else {
                Circle()
                    .fill(isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(isConnected ? "Online" : "Desconectado")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(nsColor: .controlBackgroundColor).opacity(0.6))
        .cornerRadius(12)
    }
}
