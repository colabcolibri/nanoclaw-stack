import SwiftUI

@main
struct BaraoApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            MainWindowView()
        }
        .windowStyle(.hiddenTitleBar)
        .windowToolbarStyle(.unifiedCompact)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
        
        MenuBarExtra("Barão AI", systemImage: "crown.fill") {
            Button("Abrir Barão") {
                NSApp.activate(ignoringOtherApps: true)
            }
            Divider()
            Button("Sair") {
                NSApp.terminate(nil)
            }
        }
    }
}
