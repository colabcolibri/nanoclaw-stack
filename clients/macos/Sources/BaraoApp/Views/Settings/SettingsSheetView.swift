import SwiftUI
import AppKit

public struct SettingsSheetView: View {
    @ObservedObject public var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showKey: Bool = false
    
    public init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Header
            HStack(spacing: 8) {
                Image(systemName: "gearshape.fill")
                    .font(.title3)
                    .foregroundColor(.accentColor)
                Text("Configurações do Barão")
                    .font(.title3)
                    .fontWeight(.bold)
                Spacer()
                Button(action: { dismiss() }) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .keyboardShortcut(.escape, modifiers: [])
            }
            
            Divider()
            
            // Settings Form
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    // Server Connection Section
                    VStack(alignment: .leading, spacing: 8) {
                        Text("CONEXÃO COM O SERVIDOR")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("URL do Servidor:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            TextField("https://uai.sergioluciano.com", text: $viewModel.serverUrl)
                                .textFieldStyle(.roundedBorder)
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Chave de API do Mac:")
                                .font(.caption)
                                .foregroundColor(.secondary)
                            
                            HStack(spacing: 6) {
                                if showKey {
                                    TextField("mac_...", text: $viewModel.apiKey)
                                        .textFieldStyle(.roundedBorder)
                                } else {
                                    SecureField("mac_...", text: $viewModel.apiKey)
                                        .textFieldStyle(.roundedBorder)
                                }
                                
                                Button(action: { showKey.toggle() }) {
                                    Image(systemName: showKey ? "eye.slash" : "eye")
                                        .frame(width: 24, height: 24)
                                }
                                .buttonStyle(.bordered)
                                .help(showKey ? "Ocultar chave" : "Mostrar chave")
                                
                                Button("Colar") {
                                    if let text = NSPasteboard.general.string(forType: .string) {
                                        viewModel.apiKey = text.trimmingCharacters(in: .whitespacesAndNewlines)
                                    }
                                }
                                .buttonStyle(.bordered)
                                .help("Colar da área de transferência")
                            }
                            
                            Text("Obtenha sua chave no painel web em https://uai.sergioluciano.com")
                                .font(.system(size: 10))
                                .foregroundColor(.secondary)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
                    .cornerRadius(10)
                    
                    // Voice & Sound Section
                    VStack(alignment: .leading, spacing: 10) {
                        Text("PREFERÊNCIAS DE VOZ E SOM")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(.secondary)
                        
                        Toggle("Falar respostas em voz alta automaticamente (TTS)", isOn: $viewModel.autoSpeak)
                            .font(.system(size: 13))
                        Toggle("Efeitos sonoros ao receber resposta", isOn: $viewModel.soundEffects)
                            .font(.system(size: 13))
                    }
                    .padding(12)
                    .background(Color(nsColor: .controlBackgroundColor).opacity(0.5))
                    .cornerRadius(10)
                    
                    // Test Result Feedback Banner
                    if let result = viewModel.testResult {
                        HStack(spacing: 8) {
                            switch result {
                            case .success(let msg):
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                                Text(msg)
                                    .foregroundColor(.green)
                                    .font(.callout)
                                    .fixedSize(horizontal: false, vertical: true)
                            case .failure(let err):
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .foregroundColor(.red)
                                Text(err)
                                    .foregroundColor(.red)
                                    .font(.callout)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(10)
                        .background(Color(nsColor: .controlBackgroundColor))
                        .cornerRadius(8)
                    }
                }
                .frame(maxWidth: .infinity)
            }
            
            Divider()
            
            // Bottom Action Buttons
            HStack {
                Button(action: {
                    Task { await viewModel.testConnection() }
                }) {
                    HStack(spacing: 6) {
                        if viewModel.isTesting {
                            ProgressView().scaleEffect(0.6)
                        }
                        Text("Testar Conexão")
                    }
                }
                .disabled(viewModel.isTesting)
                
                Spacer()
                
                Button("Salvar Configurações") {
                    viewModel.saveSettings()
                    dismiss()
                }
                .buttonStyle(.borderedProminent)
            }
        }
        .padding(18)
        .frame(minWidth: 440, idealWidth: 480, maxWidth: 540, minHeight: 460, idealHeight: 500, maxHeight: 560)
    }
}

