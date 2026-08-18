import SwiftUI
import AppKit

public struct MainWindowView: View {
    @StateObject private var chatViewModel = ChatViewModel()
    @StateObject private var settingsViewModel = SettingsViewModel()
    @State private var showSettings = false
    
    public init() {}
    
    public var body: some View {
        VStack(spacing: 0) {
            // Header Top Bar
            HStack(spacing: 12) {
                // Window Traffic Lights / Close button
                Button(action: {
                    NSApp.keyWindow?.orderOut(nil)
                }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 14))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .help("Fechar janela (Cmd+W)")
                
                HStack(spacing: 8) {
                    RobotAvatarView(size: 24)
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
                .help("Configurações (Cmd+,)")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(Color(nsColor: .windowBackgroundColor))
            
            // Connection Setup Warning Banner
            if !chatViewModel.isConnected && !chatViewModel.isCheckingConnection {
                HStack(spacing: 10) {
                    Image(systemName: "key.fill")
                        .foregroundColor(.orange)
                    Text("Conecte seu Barão para começar a conversar.")
                        .font(.caption)
                        .foregroundColor(.primary)
                    Spacer()
                    Button("Configurar Agora") {
                        showSettings = true
                    }
                    .font(.caption)
                    .buttonStyle(.borderedProminent)
                    .controlSize(.small)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Color.orange.opacity(0.12))
            }
            
            Divider()
            
            // Main Chat Area
            ChatView(viewModel: chatViewModel)
        }
        .frame(minWidth: 440, idealWidth: 540, maxWidth: .infinity, minHeight: 540, idealHeight: 700, maxHeight: .infinity)
        .onAppear {
            chatViewModel.onAppear()
        }
        .sheet(isPresented: $showSettings, onDismiss: {
            chatViewModel.onAppear()
        }) {
            SettingsSheetView(viewModel: settingsViewModel)
        }
        .alert("Aviso", isPresented: $chatViewModel.showErrorAlert) {
            Button("OK", role: .cancel) {}
            Button("Abrir Configurações") {
                showSettings = true
            }
        } message: {
            Text(chatViewModel.errorMessage ?? "Ocorreu um erro desconhecido.")
        }
    }
}

