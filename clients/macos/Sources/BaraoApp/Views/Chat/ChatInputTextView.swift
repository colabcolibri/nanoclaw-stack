import SwiftUI
import AppKit

/// A native macOS NSTextView wrapper that supports:
/// 1. Enter to submit, Shift+Enter / Option+Enter for new line.
/// 2. Dynamic height expansion from 1 up to 5 lines.
public struct ChatInputTextView: NSViewRepresentable {
    @Binding public var text: String
    public var isDictating: Bool
    public var minHeight: CGFloat
    public var maxHeight: CGFloat
    @Binding public var dynamicHeight: CGFloat
    public var onCommit: () -> Void
    
    public init(
        text: Binding<String>,
        isDictating: Bool = false,
        minHeight: CGFloat = 22,
        maxHeight: CGFloat = 110,
        dynamicHeight: Binding<CGFloat>,
        onCommit: @escaping () -> Void
    ) {
        self._text = text
        self.isDictating = isDictating
        self.minHeight = minHeight
        self.maxHeight = maxHeight
        self._dynamicHeight = dynamicHeight
        self.onCommit = onCommit
    }
    
    public func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }
    
    public func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSScrollView()
        scrollView.drawsBackground = false
        scrollView.borderType = .noBorder
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = false
        scrollView.autohidesScrollers = true
        
        let contentSize = scrollView.contentSize
        let textStorage = NSTextStorage()
        let layoutManager = NSLayoutManager()
        textStorage.addLayoutManager(layoutManager)
        
        let textContainer = NSTextContainer(containerSize: NSSize(width: contentSize.width, height: CGFloat.greatestFiniteMagnitude))
        textContainer.widthTracksTextView = true
        textContainer.lineFragmentPadding = 0
        layoutManager.addTextContainer(textContainer)
        
        let textView = ChatNSTextView(frame: NSRect(origin: .zero, size: contentSize), textContainer: textContainer)
        textView.delegate = context.coordinator
        textView.onCommit = onCommit
        textView.font = NSFont.systemFont(ofSize: 14)
        textView.textColor = NSColor.labelColor
        textView.drawsBackground = false
        textView.backgroundColor = .clear
        textView.isRichText = false
        textView.importsGraphics = false
        textView.allowsUndo = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainerInset = NSSize(width: 0, height: 2)
        textView.insertionPointColor = NSColor.controlAccentColor
        
        scrollView.documentView = textView
        
        DispatchQueue.main.async {
            context.coordinator.updateHeight(textView: textView)
        }
        
        return scrollView
    }
    
    public func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? ChatNSTextView else { return }
        
        textView.onCommit = onCommit
        
        if textView.string != text {
            textView.string = text
            if isDictating {
                let endLocation = (text as NSString).length
                textView.setSelectedRange(NSRange(location: endLocation, length: 0))
                textView.scrollRangeToVisible(NSRange(location: endLocation, length: 0))
            }
            context.coordinator.updateHeight(textView: textView)
        }
    }
    
    public final class Coordinator: NSObject, NSTextViewDelegate {
        var parent: ChatInputTextView
        
        init(_ parent: ChatInputTextView) {
            self.parent = parent
        }
        
        public func textDidChange(_ notification: Notification) {
            guard let textView = notification.object as? NSTextView else { return }
            let newText = textView.string
            if self.parent.text != newText {
                self.parent.text = newText
            }
            updateHeight(textView: textView)
        }
        
        func updateHeight(textView: NSTextView) {
            guard let layoutManager = textView.layoutManager,
                  let textContainer = textView.textContainer else { return }
            
            layoutManager.ensureLayout(for: textContainer)
            let usedRect = layoutManager.usedRect(for: textContainer)
            
            let font = textView.font ?? NSFont.systemFont(ofSize: 14)
            let lineHeight = font.ascender - font.descender + font.leading
            
            let singleLineHeight = max(parent.minHeight, ceil(lineHeight + textView.textContainerInset.height * 2))
            let fiveLinesHeight = singleLineHeight + ceil(lineHeight * 4)
            let calculatedMaxHeight = min(parent.maxHeight, fiveLinesHeight)
            
            let textHeight = ceil(usedRect.height + textView.textContainerInset.height * 2)
            let newHeight = max(singleLineHeight, min(textHeight, calculatedMaxHeight))
            
            if abs(parent.dynamicHeight - newHeight) > 1.0 {
                DispatchQueue.main.async {
                    self.parent.dynamicHeight = newHeight
                }
            }
        }
    }
}

final class ChatNSTextView: NSTextView {
    var onCommit: (() -> Void)?
    
    override func keyDown(with event: NSEvent) {
        // Return key code is 36, Keypad Enter is 76
        if event.keyCode == 36 || event.keyCode == 76 {
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            let cleanFlags = flags.subtracting([.capsLock, .numericPad, .function])
            
            // Shift + Enter or Option + Enter or Control + Enter -> Insert newline
            if cleanFlags.contains(.shift) || cleanFlags.contains(.option) || cleanFlags.contains(.control) {
                super.insertNewline(nil)
                return
            }
            
            // Plain Enter / Return or Cmd + Enter -> Send message
            if cleanFlags.isEmpty || cleanFlags == .command {
                onCommit?()
                return
            }
        }
        
        super.keyDown(with: event)
    }
}
