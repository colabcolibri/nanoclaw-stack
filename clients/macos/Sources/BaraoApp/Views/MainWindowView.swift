import SwiftUI
import AppKit

public struct MainWindowView: View {
    @StateObject private var chatViewModel = ChatViewModel()
    @StateObject private var settingsViewModel = SettingsViewModel()
    @State private var showSettings = false
    @State private var showClearConfirm = false
    
    public init() {}
    
    public var body: some View {
        VStack(spacing: 0) {
            // Header Top Bar
            HStack(spacing: 12) {
                Button(action: {
                    NSApp.keyWindow?.orderOut(nil)
                }) {
                    Image(systemName: "xmark")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(.secondary)
                        .frame(width: 28, height: 28)
                        .background(Color.primary.opacity(0.05), in: Circle())
                }
                .buttonStyle(.plain)
                .help("Fechar janela (Cmd+W)")
                
                HStack(spacing: 8) {
                    RobotAvatarView(size: 22)
                    Text("Barão")
                        .font(.system(size: 15, weight: .semibold))
                }
                
                StatusIndicatorView(
                    isConnected: chatViewModel.isConnected,
                    isChecking: chatViewModel.isCheckingConnection
                )
                
                Spacer()
                
                headerIconButton(icon: "trash", help: "Limpar histórico") {
                    showClearConfirm = true
                }
                .disabled(chatViewModel.messages.isEmpty)
                
                headerIconButton(icon: "gearshape", help: "Configurações (Cmd+,)") {
                    showSettings = true
                }
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 10)
            .background(.bar)
            
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
        .onReceive(NotificationCenter.default.publisher(for: AppConstants.Notifications.openSettings)) { _ in
            showSettings = true
        }
        .sheet(isPresented: $showSettings, onDismiss: {
            chatViewModel.onAppear()
        }) {
            SettingsSheetView(viewModel: settingsViewModel)
        }
        .confirmationDialog(
            "Limpar histórico?",
            isPresented: $showClearConfirm,
            titleVisibility: .visible
        ) {
            Button("Limpar histórico", role: .destructive) {
                chatViewModel.clearConversation()
            }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Isso remove a conversa local e reinicia a sessão no servidor.")
        }
        .background {
            Button("") { showSettings = true }
                .keyboardShortcut(",", modifiers: .command)
                .hidden()
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
    
    private func headerIconButton(icon: String, help: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.secondary)
                .frame(width: 28, height: 28)
                .background(Color.primary.opacity(0.05), in: Circle())
        }
        .buttonStyle(.plain)
        .help(help)
    }
}

