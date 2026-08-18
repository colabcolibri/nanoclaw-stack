import SwiftUI

public struct SettingsSheetView: View {
    @ObservedObject public var viewModel: SettingsViewModel
    @Environment(\.dismiss) private var dismiss
    
    public init(viewModel: SettingsViewModel) {
        self.viewModel = viewModel
    }
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Image(systemName: "gearshape.fill")
                    .font(.title2)
                    .foregroundColor(.accentColor)
                Text("Configurações do Barão")
                    .font(.title2)
                    .fontWeight(.bold)
                Spacer()
                Button("Fechar") { dismiss() }
                    .keyboardShortcut(.escape, modifiers: [])
            }
            
            Divider()
            
            Form {
                Section(header: Text("Conexão com o Servidor").font(.headline)) {
                    TextField("URL do Servidor NanoClaw:", text: $viewModel.serverUrl)
                        .textFieldStyle(.roundedBorder)
                    
                    VStack(alignment: .leading, spacing: 6) {
                        HStack {
                            SecureField("Chave de API do Mac (mac_...):", text: $viewModel.apiKey)
                                .textFieldStyle(.roundedBorder)
                            
                            Button("Colar") {
                                if let text = NSPasteboard.general.string(forType: .string) {
                                    viewModel.apiKey = text.trimmingCharacters(in: .whitespacesAndNewlines)
                                }
                            }
                            .buttonStyle(.bordered)
                            .help("Colar chave da área de transferência")
                        }
                        
                        Text("Pegue sua chave no painel web (Configurações > Mac) ou no arquivo mac_channel.json")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                }
                
                Section(header: Text("Preferências de Voz e Som").font(.headline)) {
                    Toggle("Falar respostas em voz alta automaticamente (TTS)", isOn: $viewModel.autoSpeak)
                    Toggle("Efeitos sonoros ao receber resposta", isOn: $viewModel.soundEffects)
                }
            }
            
            if let result = viewModel.testResult {
                HStack(spacing: 8) {
                    switch result {
                    case .success(let msg):
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text(msg)
                            .foregroundColor(.green)
                            .font(.callout)
                    case .failure(let err):
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                        Text(err)
                            .foregroundColor(.red)
                            .font(.callout)
                    }
                }
                .padding(8)
                .background(Color(nsColor: .controlBackgroundColor))
                .cornerRadius(8)
            }
            
            Spacer()
            
            HStack {
                Button(action: {
                    Task { await viewModel.testConnection() }
                }) {
                    HStack {
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
        .padding(20)
        .frame(width: 480, height: 420)
    }
}
