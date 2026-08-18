import Foundation

/// Connection and behavioral settings for the macOS app.
public struct AppConfig: Codable, Equatable {
    public var serverUrl: String
    public var apiKey: String
    public var assistantName: String
    public var autoSpeak: Bool
    public var soundEffects: Bool
    public var groupFolder: String
    
    public init(
        serverUrl: String = AppConstants.defaultServerUrl,
        apiKey: String = "",
        assistantName: String = AppConstants.appName,
        autoSpeak: Bool = false,
        soundEffects: Bool = true,
        groupFolder: String = AppConstants.defaultGroup
    ) {
        self.serverUrl = serverUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        self.apiKey = apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        self.assistantName = assistantName
        self.autoSpeak = autoSpeak
        self.soundEffects = soundEffects
        self.groupFolder = groupFolder
    }
    
    public var isValid: Bool {
        !serverUrl.isEmpty && !apiKey.isEmpty
    }
}
