import SwiftUI

public struct MainWindowView: View {
    @StateObject private var chatViewModel = ChatViewModel()
    @StateObject private var settingsViewModel = SettingsViewModel()
    @State private var showSettings = false
    
    public init() {}
    
    public var body: some View {
        VStack(spacing: 0) {
            // Header Top Bar
            HStack(spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "crown.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.accentColor)
                    Text("Barão AI")
                        .font(.headline)
                        .fontWeight(.bold)
                }
                
                StatusIndicatorView(
                    isConnected: chatViewModel.isConnected,
                    isChecking: chatViewModel.isCheckingConnection
                )
                
                Spacer()
                
                Button(action: { chatViewModel.clearConversation() }) {
                    Image(systemName: "trash")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .help("Limpar histórico da conversa")
                
                Button(action: { showSettings = true }) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .help("Configurações")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))
            
            Divider()
            
            // Main Chat Area
            ChatView(viewModel: chatViewModel)
        }
        .frame(minWidth: 420, minHeight: 520)
        .onAppear {
            chatViewModel.onAppear()
        }
        .sheet(isPresented: $showSettings) {
            SettingsSheetView(viewModel: settingsViewModel)
        }
        .alert("Aviso", isPresented: $chatViewModel.showErrorAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(chatViewModel.errorMessage ?? "Ocorreu um erro desconhecido.")
        }
    }
}
