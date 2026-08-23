import Foundation
import SwiftUI

/// Centralized app constants and design tokens adhering to DRY
public enum AppConstants {
    public static let appName = "Barão"
    public static let defaultServerUrl = "https://uai.sergioluciano.com"
    public static let defaultGroup = "barao"
    public static let appVersion = "1.3.1"
    public static let buildNumber = "6"
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
        public static let userBubble = Color.accentColor
        public static let assistantBubble = Color(nsColor: .controlBackgroundColor)
        public static let background = Color(nsColor: .windowBackgroundColor)
        public static let chatCanvas = Color(nsColor: .textBackgroundColor)
    }

    public enum ChatDesign {
        public static let bubbleMaxWidth: CGFloat = 340
        public static let bubbleRadius: CGFloat = 18
        public static let messageSpacing: CGFloat = 14
        public static let horizontalPadding: CGFloat = 16
        public static let userBubbleGradient = LinearGradient(
            colors: [Color.accentColor, Color.accentColor.opacity(0.82)],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }

    public enum Notifications {
        public static let openSettings = Notification.Name("BaraoOpenSettings")
    }
}
