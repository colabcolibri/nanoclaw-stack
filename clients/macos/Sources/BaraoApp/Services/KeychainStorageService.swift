import Foundation
import Security

public final class KeychainStorageService: StorageServiceProtocol {
    public static let shared = KeychainStorageService()
    
    private let serviceName = AppConstants.bundleIdentifier
    private let userDefaults = UserDefaults.standard
    
    private init() {}
    
    public func loadConfig() -> AppConfig {
        let serverUrl = userDefaults.string(forKey: AppConstants.UserDefaultsKeys.serverUrl) ?? AppConstants.defaultServerUrl
        let assistantName = userDefaults.string(forKey: AppConstants.UserDefaultsKeys.assistantName) ?? AppConstants.appName
        let autoSpeak = userDefaults.bool(forKey: AppConstants.UserDefaultsKeys.autoSpeak)
        let soundEffects = userDefaults.object(forKey: AppConstants.UserDefaultsKeys.soundEffects) as? Bool ?? true
        let apiKey = getApiKey() ?? ""
        
        return AppConfig(
            serverUrl: serverUrl,
            apiKey: apiKey,
            assistantName: assistantName,
            autoSpeak: autoSpeak,
            soundEffects: soundEffects,
            groupFolder: AppConstants.defaultGroup
        )
    }
    
    public func saveConfig(_ config: AppConfig) {
        userDefaults.set(config.serverUrl, forKey: AppConstants.UserDefaultsKeys.serverUrl)
        userDefaults.set(config.assistantName, forKey: AppConstants.UserDefaultsKeys.assistantName)
        userDefaults.set(config.autoSpeak, forKey: AppConstants.UserDefaultsKeys.autoSpeak)
        userDefaults.set(config.soundEffects, forKey: AppConstants.UserDefaultsKeys.soundEffects)
        saveApiKey(config.apiKey)
    }
    
    public func getApiKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: AppConstants.KeychainKeys.apiKey,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        
        guard status == errSecSuccess, let data = item as? Data else {
            // Fallback to UserDefaults if Keychain is unaccessible in dev environment
            return userDefaults.string(forKey: AppConstants.KeychainKeys.apiKey)
        }
        
        return String(data: data, encoding: .utf8)
    }
    
    public func saveApiKey(_ key: String) {
        let data = Data(key.utf8)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: AppConstants.KeychainKeys.apiKey
        ]
        
        SecItemDelete(query as CFDictionary)
        
        if !key.isEmpty {
            var attributes = query
            attributes[kSecValueData as String] = data
            SecItemAdd(attributes as CFDictionary, nil)
            userDefaults.set(key, forKey: AppConstants.KeychainKeys.apiKey)
        } else {
            userDefaults.removeObject(forKey: AppConstants.KeychainKeys.apiKey)
        }
    }
}
