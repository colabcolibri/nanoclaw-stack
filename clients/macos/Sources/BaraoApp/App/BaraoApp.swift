import SwiftUI
import AppKit

@main
struct BaraoApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup("Barão AI", id: "main-chat") {
            MainWindowView()
                .frame(minWidth: 460, idealWidth: 500, minHeight: 580, idealHeight: 650)
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
        
        MenuBarExtra("Barão AI", systemImage: "crown.fill") {
            Button("Abrir Janela do Barão") {
                AppDelegate.shared?.showMainWindow()
            }
            Divider()
            Button("Configurações...") {
                AppDelegate.shared?.showMainWindow()
            }
            Divider()
            Button("Encerrar Barão") {
                NSApp.terminate(nil)
            }
            .keyboardShortcut("q", modifiers: .command)
        }
    }
}
