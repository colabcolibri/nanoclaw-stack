import Foundation
import SwiftUI

/// Centralized app constants and design tokens adhering to DRY
public enum AppConstants {
    public static let appName = "Barão"
    public static let defaultServerUrl = "https://uai.sergioluciano.com"
    public static let defaultGroup = "barao"
    public static let appVersion = "1.2.0"
    public static let buildNumber = "3"
    public static let bundleIdentifier = "com.colabcolibri.barao"
    
    public enum KeychainKeys {
        public static let apiKey = "com.colabcolibri.barao.apiKey"
        public static let serverUrl = "com.colabcolibri.barao.serverUrl"
    }
    
    public enum UserDefaultsKeys {
        public static let assistantName = "assistantName"
        public static let autoSpeak = "autoSpeak"
        public static let soundEffects = "soundEffects"
        public static let serverUrl = "serverUrl"
        public static let globalHotkey = "globalHotkey"
    }
    
    public enum Colors {
        public static let accentColor = Color.accentColor
        public static let userBubble = Color.blue
        public static let assistantBubble = Color(nsColor: .controlBackgroundColor)
        public static let background = Color(nsColor: .windowBackgroundColor)
    }
}
