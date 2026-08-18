import Foundation
import AppKit

public final class AppDelegate: NSObject, NSApplicationDelegate {
    public static var shared: AppDelegate?
    
    public func applicationDidFinishLaunching(_ notification: Notification) {
        AppDelegate.shared = self
        
        // Guarantee standard regular macOS app windowing and Dock appearance
        NSApp.setActivationPolicy(.regular)
        
        // Bring window forward on launch
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
            self.showMainWindow()
        }
        
        // Register local shortcut
        HotkeyManagerService.shared.registerLocalShortcuts { [weak self] in
            self?.toggleMainWindow()
        }
    }
    
    public func showMainWindow() {
        NSApp.activate(ignoringOtherApps: true)
        let normalWindows = NSApp.windows.filter { !($0 is NSStatusBarWindow) }
        if let window = normalWindows.first(where: { $0.canBecomeKey }) {
            window.makeKeyAndOrderFront(nil)
            window.center()
        } else if let window = normalWindows.first {
            window.makeKeyAndOrderFront(nil)
        }
    }
    
    public func toggleMainWindow() {
        if NSApp.isActive, let window = NSApp.keyWindow, window.isVisible {
            window.orderOut(nil)
        } else {
            showMainWindow()
        }
    }
    
    public func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showMainWindow()
        return true
    }
}
