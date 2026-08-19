import SwiftUI
import AppKit

public enum MarkdownBlock: Identifiable {
    case header(level: Int, text: String)
    case paragraph(String)
    case codeBlock(language: String, code: String)
    case blockquote(String)
    case listItem(text: String, isNumbered: Bool, index: Int)
    case divider
    
    public var id: String {
        switch self {
        case .header(let level, let text): return "h-\(level)-\(text.prefix(20))-\(UUID().uuidString)"
        case .paragraph(let text): return "p-\(text.prefix(20))-\(UUID().uuidString)"
        case .codeBlock(let lang, let code): return "code-\(lang)-\(code.prefix(20))-\(UUID().uuidString)"
        case .blockquote(let text): return "quote-\(text.prefix(20))-\(UUID().uuidString)"
        case .listItem(let text, _, let index): return "list-\(index)-\(text.prefix(20))-\(UUID().uuidString)"
        case .divider: return "div-\(UUID().uuidString)"
        }
    }
}

public struct MarkdownContentView: View {
    public let text: String
    public let isUser: Bool
    
    public init(text: String, isUser: Bool = false) {
        self.text = text
        self.isUser = isUser
    }
    
    public var body: some View {
        let blocks = parseMarkdown(text)
        
        VStack(alignment: .leading, spacing: 8) {
            ForEach(blocks, id: \.id) { block in
                switch block {
                case .header(let level, let content):
                    headerView(level: level, text: content)
                    
                case .paragraph(let content):
                    Text(LocalizedStringKey(content))
                        .font(.system(size: 14, weight: .regular))
                        .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                        .textSelection(.enabled)
                        .lineSpacing(3)
                        .fixedSize(horizontal: false, vertical: true)
                    
                case .codeBlock(let language, let code):
                    CodeBlockView(language: language, code: code, isUser: isUser)
                    
                case .blockquote(let content):
                    HStack(alignment: .top, spacing: 8) {
                        Rectangle()
                            .fill(isUser ? Color.white.opacity(0.6) : Color.accentColor)
                            .frame(width: 3)
                        Text(LocalizedStringKey(content))
                            .font(.system(size: 13.5, weight: .regular))
                            .italic()
                            .foregroundColor(isUser ? .white.opacity(0.9) : .secondary)
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.vertical, 2)
                    
                case .listItem(let content, let isNumbered, let index):
                    HStack(alignment: .top, spacing: 6) {
                        Text(isNumbered ? "\(index)." : "•")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundColor(isUser ? .white.opacity(0.8) : Color.accentColor)
                            .frame(width: isNumbered ? 18 : 10, alignment: .leading)
                        Text(LocalizedStringKey(content))
                            .font(.system(size: 14, weight: .regular))
                            .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                            .textSelection(.enabled)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .padding(.leading, 4)
                    
                case .divider:
                    Divider()
                        .padding(.vertical, 4)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    @ViewBuilder
    private func headerView(level: Int, text: String) -> some View {
        switch level {
        case 1:
            Text(LocalizedStringKey(text))
                .font(.system(size: 18, weight: .bold))
                .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                .padding(.top, 4)
                .textSelection(.enabled)
        case 2:
            Text(LocalizedStringKey(text))
                .font(.system(size: 16, weight: .bold))
                .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                .padding(.top, 3)
                .textSelection(.enabled)
        default:
            Text(LocalizedStringKey(text))
                .font(.system(size: 14.5, weight: .semibold))
                .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                .padding(.top, 2)
                .textSelection(.enabled)
        }
    }
    
    private func parseMarkdown(_ raw: String) -> [MarkdownBlock] {
        var blocks: [MarkdownBlock] = []
        let lines = raw.components(separatedBy: "\n")
        var inCodeBlock = false
        var currentCodeLang = ""
        var currentCodeLines: [String] = []
        var paragraphLines: [String] = []
        var listIndex = 1
        
        func flushParagraph() {
            if !paragraphLines.isEmpty {
                let joined = paragraphLines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
                if !joined.isEmpty {
                    blocks.append(.paragraph(joined))
                }
                paragraphLines.removeAll()
            }
        }
        
        for line in lines {
            let trimmed = line.trimmingCharacters(in: .whitespaces)
            
            // Check for Code Block fences ```
            if trimmed.hasPrefix("```") {
                if inCodeBlock {
                    // Close code block
                    let fullCode = currentCodeLines.joined(separator: "\n")
                    blocks.append(.codeBlock(language: currentCodeLang, code: fullCode))
                    currentCodeLines.removeAll()
                    currentCodeLang = ""
                    inCodeBlock = false
                } else {
                    flushParagraph()
                    inCodeBlock = true
                    currentCodeLang = String(trimmed.dropFirst(3)).trimmingCharacters(in: .whitespaces)
                }
                continue
            }
            
            if inCodeBlock {
                currentCodeLines.append(line)
                continue
            }
            
            // Horizontal rule
            if trimmed == "---" || trimmed == "***" || trimmed == "___" {
                flushParagraph()
                blocks.append(.divider)
                continue
            }
            
            // Headings
            if trimmed.hasPrefix("#") {
                flushParagraph()
                if trimmed.hasPrefix("### ") {
                    blocks.append(.header(level: 3, text: String(trimmed.dropFirst(4))))
                } else if trimmed.hasPrefix("## ") {
                    blocks.append(.header(level: 2, text: String(trimmed.dropFirst(3))))
                } else if trimmed.hasPrefix("# ") {
                    blocks.append(.header(level: 1, text: String(trimmed.dropFirst(2))))
                } else {
                    paragraphLines.append(line)
                }
                continue
            }
            
            // Blockquote
            if trimmed.hasPrefix(">") {
                flushParagraph()
                let quoteText = String(trimmed.dropFirst(1)).trimmingCharacters(in: .whitespaces)
                blocks.append(.blockquote(quoteText))
                continue
            }
            
            // Unordered List
            if trimmed.hasPrefix("- ") || trimmed.hasPrefix("* ") || trimmed.hasPrefix("• ") {
                flushParagraph()
                let itemText = String(trimmed.dropFirst(2)).trimmingCharacters(in: .whitespaces)
                blocks.append(.listItem(text: itemText, isNumbered: false, index: 0))
                continue
            }
            
            // Numbered List (e.g. "1. ")
            if let match = trimmed.range(of: "^[0-9]+[\\.)]\\s+", options: .regularExpression) {
                flushParagraph()
                let numStr = trimmed[match].filter { $0.isNumber }
                let idx = Int(numStr) ?? listIndex
                let itemText = String(trimmed[match.upperBound...]).trimmingCharacters(in: .whitespaces)
                blocks.append(.listItem(text: itemText, isNumbered: true, index: idx))
                listIndex = idx + 1
                continue
            }
            
            if trimmed.isEmpty {
                flushParagraph()
                listIndex = 1
            } else {
                paragraphLines.append(line)
            }
        }
        
        if inCodeBlock && !currentCodeLines.isEmpty {
            blocks.append(.codeBlock(language: currentCodeLang, code: currentCodeLines.joined(separator: "\n")))
        }
        flushParagraph()
        
        return blocks.isEmpty ? [.paragraph(raw)] : blocks
    }
}

public struct CodeBlockView: View {
    public let language: String
    public let code: String
    public let isUser: Bool
    
    @State private var copied = false
    
    public var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header Bar
            HStack {
                Text(language.isEmpty ? "code" : language.lowercased())
                    .font(.system(size: 11, weight: .bold, design: .monospaced))
                    .foregroundColor(isUser ? .white.opacity(0.8) : .secondary)
                
                Spacer()
                
                Button(action: {
                    NSPasteboard.general.clearContents()
                    NSPasteboard.general.setString(code, forType: .string)
                    copied = true
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                        copied = false
                    }
                }) {
                    HStack(spacing: 4) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                        Text(copied ? "Copiado!" : "Copiar")
                    }
                    .font(.system(size: 10, weight: .medium))
                    .foregroundColor(isUser ? .white : .secondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(isUser ? Color.black.opacity(0.2) : Color(nsColor: .windowBackgroundColor).opacity(0.8))
            
            Divider()
            
            // Code Content
            ScrollView(.horizontal, showsIndicators: true) {
                Text(code)
                    .font(.system(size: 12.5, weight: .regular, design: .monospaced))
                    .foregroundColor(isUser ? .white : Color(nsColor: .textColor))
                    .textSelection(.enabled)
                    .padding(10)
            }
        }
        .background(isUser ? Color.black.opacity(0.15) : Color(nsColor: .controlBackgroundColor))
        .cornerRadius(8)
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(isUser ? Color.white.opacity(0.2) : Color.secondary.opacity(0.2), lineWidth: 1)
        )
        .padding(.vertical, 4)
    }
}
