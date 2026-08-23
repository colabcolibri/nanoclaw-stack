import Foundation

/// Connection and behavioral settings for the macOS app.
public struct AppConfig: Codable, Equatable {
    public var serverUrl: String
    public var apiKey: String
    public var assistantName: String
    public var autoSpeak: Bool
    public var soundEffects: Bool
    public var groupFolder: String
    
  /// Normalizes server URL: trims slashes and fixes https→http for local dev hosts.
    public static func normalizeServerUrl(_ raw: String) -> String {
        var url = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            .trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let lower = url.lowercased()
        if lower.hasPrefix("https://localhost") || lower.hasPrefix("https://127.0.0.1") {
            url = "http://" + url.dropFirst("https://".count)
        }
        return url
    }

    public init(
        serverUrl: String = AppConstants.defaultServerUrl,
        apiKey: String = "",
        assistantName: String = AppConstants.appName,
        autoSpeak: Bool = false,
        soundEffects: Bool = true,
        groupFolder: String = AppConstants.defaultGroup
    ) {
        self.serverUrl = AppConfig.normalizeServerUrl(serverUrl)
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
