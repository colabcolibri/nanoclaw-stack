import Foundation
import AppKit

public final class AppDelegate: NSObject, NSApplicationDelegate {
    public static var shared: AppDelegate?
    
    public func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        // Register local shortcut
        HotkeyManagerService.shared.registerLocalShortcuts {
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}
