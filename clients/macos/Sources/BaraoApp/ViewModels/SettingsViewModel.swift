import Foundation
import SwiftUI

@MainActor
public final class SettingsViewModel: ObservableObject {
    @Published public var serverUrl: String = ""
    @Published public var apiKey: String = ""
    @Published public var assistantName: String = ""
    @Published public var autoSpeak: Bool = false
    @Published public var soundEffects: Bool = true
    @Published public var groupFolder: String = "barao"
    
    @Published public var isTesting: Bool = false
    @Published public var testResult: TestResult? = nil
    
    public enum TestResult: Equatable {
        case success(String)
        case failure(String)
    }
    
    private let storage: StorageServiceProtocol
    private let apiClient: ApiClientProtocol
    
    public init(
        storage: StorageServiceProtocol = KeychainStorageService.shared,
        apiClient: ApiClientProtocol = ApiClientService.shared
    ) {
        self.storage = storage
        self.apiClient = apiClient
        loadSettings()
    }
    
    public func loadSettings() {
        let config = storage.loadConfig()
        self.serverUrl = config.serverUrl
        self.apiKey = config.apiKey
        self.assistantName = config.assistantName
        self.autoSpeak = config.autoSpeak
        self.soundEffects = config.soundEffects
        self.groupFolder = config.groupFolder
    }
    
    public func saveSettings() {
        let config = AppConfig(
            serverUrl: serverUrl,
            apiKey: apiKey,
            assistantName: assistantName,
            autoSpeak: autoSpeak,
            soundEffects: soundEffects,
            groupFolder: groupFolder
        )
        storage.saveConfig(config)
    }
    
    public func testConnection() async {
        isTesting = true
        testResult = nil
        
        let config = AppConfig(
            serverUrl: serverUrl,
            apiKey: apiKey,
            assistantName: assistantName,
            autoSpeak: autoSpeak,
            soundEffects: soundEffects,
            groupFolder: groupFolder
        )
        
        guard config.isValid else {
            testResult = .failure("Preencha a URL do Servidor e a Chave de API.")
            isTesting = false
            return
        }
        
        do {
            let ok = try await apiClient.verifyConnection(config: config)
            if ok {
                testResult = .success("Conectado com sucesso ao Barão!")
                saveSettings()
            } else {
                testResult = .failure("Não foi possível autenticar. Verifique a chave de API.")
            }
        } catch {
            testResult = .failure(error.localizedDescription)
        }
        
        isTesting = false
    }
}
