import Foundation
import AppKit
import Carbon

public final class HotkeyManagerService {
    public static let shared = HotkeyManagerService()
    private var eventMonitor: Any?
    
    private init() {}
    
    /// Starts monitoring for local keyboard shortcuts: Ctrl + \ (keyCode 42)
    public func registerLocalShortcuts(onToggleWindow: @escaping () -> Void) {
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            // Check for Control modifier + Backslash key (\, keyCode 42)
            if event.modifierFlags.contains(.control) && event.keyCode == 42 {
                onToggleWindow()
                return nil
            }
            return event
        }
    }
    
    deinit {
        if let monitor = eventMonitor {
            NSEvent.removeMonitor(monitor)
        }
    }
}
