import Foundation
import AppKit
import Carbon

public final class HotkeyManagerService {
    public static let shared = HotkeyManagerService()
    private var eventMonitor: Any?
    
    private init() {}
    
    /// Starts monitoring for local keyboard shortcuts
    public func registerLocalShortcuts(onToggleWindow: @escaping () -> Void) {
        eventMonitor = NSEvent.addLocalMonitorForEvents(matching: .keyDown) { event in
            // Option + Space or Cmd + Shift + B
            if event.modifierFlags.contains(.option) && event.keyCode == 49 { // 49 = Spacebar
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
