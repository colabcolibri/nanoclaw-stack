import SwiftUI
import AppKit

/// A native macOS NSTextView wrapper that supports:
/// 1. Enter to submit, Shift+Enter / Option+Enter / Ctrl+Enter for paragraph/newline.
/// 2. Dynamic height expansion from 1 up to 5 lines, accounting for trailing newlines.
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
        textContainer.lineFragmentPadding = 2
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
        textView.isEditable = true
        textView.isSelectable = true
        textView.isVerticallyResizable = true
        textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainerInset = NSSize(width: 0, height: 0)
        textView.insertionPointColor = NSColor.controlAccentColor
        
        scrollView.documentView = textView
        context.coordinator.textView = textView
        context.coordinator.scrollView = scrollView
        
        DispatchQueue.main.async {
            context.coordinator.syncDocumentFrame()
            context.coordinator.updateHeight(textView: textView)
        }
        
        return scrollView
    }
    
    public func updateNSView(_ nsView: NSScrollView, context: Context) {
        guard let textView = nsView.documentView as? ChatNSTextView else { return }
        
        textView.onCommit = onCommit
        context.coordinator.syncDocumentFrame()
        
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
        weak var textView: NSTextView?
        weak var scrollView: NSScrollView?
        
        init(_ parent: ChatInputTextView) {
            self.parent = parent
        }
        
        func syncDocumentFrame() {
            guard let scrollView, let textView else { return }
            let clipHeight = scrollView.contentSize.height
            guard clipHeight > 0 else { return }
            
            var frame = textView.frame
            frame.origin = .zero
            frame.size.width = scrollView.contentSize.width
            frame.size.height = max(clipHeight, frame.height)
            textView.frame = frame
            textView.isVerticallyResizable = true
            textView.maxSize = NSSize(width: CGFloat.greatestFiniteMagnitude, height: CGFloat.greatestFiniteMagnitude)
            textView.minSize = NSSize(width: 0, height: clipHeight)
        }
        
        private func verticalInset(for textView: NSTextView, lineHeight: CGFloat, contentHeight: CGFloat) -> CGFloat {
            let inset = floor((contentHeight - lineHeight) / 2)
            return max(0, inset)
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
            var textHeight = layoutManager.usedRect(for: textContainer).height
            
            let font = textView.font ?? NSFont.systemFont(ofSize: 14)
            let lineHeight = max(18.0, ceil(font.ascender - font.descender + font.leading))
            
            // Check for trailing newlines because layoutManager doesn't generate rects for empty lines
            let string = textView.string
            if string.hasSuffix("\n") {
                var trailingCount = 0
                for char in string.reversed() {
                    if char == "\n" {
                        trailingCount += 1
                    } else {
                        break
                    }
                }
                textHeight += CGFloat(trailingCount) * lineHeight
            }
            
            let singleLineHeight = max(parent.minHeight, ceil(lineHeight))
            let fiveLinesHeight = singleLineHeight + ceil(lineHeight * 4)
            let calculatedMaxHeight = min(parent.maxHeight, fiveLinesHeight)
            
            let rawTextHeight = max(lineHeight, ceil(textHeight))
            let totalHeight = min(max(singleLineHeight, rawTextHeight), calculatedMaxHeight)
            let isSingleLine = rawTextHeight <= lineHeight + 1
            let insetY = isSingleLine
                ? verticalInset(for: textView, lineHeight: lineHeight, contentHeight: totalHeight)
                : 0
            textView.textContainerInset = NSSize(width: 0, height: insetY)
            
            let newHeight = totalHeight
            
            syncDocumentFrame()
            if abs(parent.dynamicHeight - newHeight) > 0.5 {
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
        // Return key (36) or Keypad Enter (76)
        if event.keyCode == 36 || event.keyCode == 76 {
            let flags = event.modifierFlags.intersection(.deviceIndependentFlagsMask)
            let cleanFlags = flags.subtracting([.capsLock, .numericPad, .function])
            
            // Shift + Return, Option + Return, Control + Return -> Insert newline / paragraph
            if cleanFlags.contains(.shift) || cleanFlags.contains(.option) || cleanFlags.contains(.control) {
                if shouldChangeText(in: selectedRange(), replacementString: "\n") {
                    insertText("\n", replacementRange: selectedRange())
                    didChangeText()
                }
                return
            }
            
            // Plain Return / Enter or Cmd + Return -> Submit
            if cleanFlags.isEmpty || cleanFlags == .command {
                onCommit?()
                return
            }
        }
        
        super.keyDown(with: event)
    }
}
