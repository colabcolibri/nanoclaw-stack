import Foundation
import AppIntents

@available(macOS 13.0, *)
public struct AskBaraoIntent: AppIntent {
    public static var title: LocalizedStringResource = "Perguntar ao Barão"
    public static var description = IntentDescription("Envia uma instrução ou pergunta diretamente ao assistente Barão e recebe a resposta falada.")
    public static var openAppWhenRun: Bool = false
    
    @Parameter(title: "Mensagem ou Pergunta", description: "O que você deseja pedir ao Barão?", requestValueDialog: "O que você deseja pedir ao Barão?")
    public var prompt: String
    
    public init() {}
    
    public init(prompt: String) {
        self.prompt = prompt
    }
    
    public func perform() async throws -> some IntentResult & ProvidesDialog & ReturnsValue<String> {
        let storage = KeychainStorageService.shared
        let config = storage.loadConfig()
        
        guard config.isValid else {
            let msg = "Por favor, abra o aplicativo do Barão e configure sua chave de acesso primeiro."
            return .result(
                value: msg,
                dialog: IntentDialog(stringLiteral: msg)
            )
        }
        
        do {
            let response = try await ApiClientService.shared.sendPrompt(prompt, config: config)
            let reply = response.reply ?? "Instrução processada com sucesso."
            
            // Broadcast so that if the main window is open, it appears in the chat thread
            DispatchQueue.main.async {
                NotificationCenter.default.post(
                    name: NSNotification.Name("BaraoMessageFromSiri"),
                    object: nil,
                    userInfo: ["prompt": prompt, "reply": reply]
                )
            }
            
            return .result(
                value: reply,
                dialog: IntentDialog(stringLiteral: reply)
            )
        } catch {
            let errStr = "Desculpe, ocorreu um erro ao consultar o Barão: \(error.localizedDescription)"
            return .result(
                value: errStr,
                dialog: IntentDialog(stringLiteral: errStr)
            )
        }
    }
}

@available(macOS 13.0, *)
public struct BaraoShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: AskBaraoIntent(),
            phrases: [
                "Perguntar ao \(.applicationName)",
                "Falar com o \(.applicationName)",
                "Pedir ao \(.applicationName)",
                "Mensagem para o \(.applicationName)",
                "Conversar com o \(.applicationName)"
            ],
            shortTitle: "Perguntar ao Barão",
            systemImageName: "crown.fill"
        )
    }
}
