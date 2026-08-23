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
                Text(isConnected ? "Conectado" : "Desconectado")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(.ultraThinMaterial, in: Capsule())
        .overlay(Capsule().stroke(Color.primary.opacity(0.06), lineWidth: 1))
    }
}
