import SwiftUI
import MarkdownUI

public struct MarkdownContentView: View {
    public let text: String
    public let isUser: Bool
    
    public init(text: String, isUser: Bool = false) {
        self.text = text
        self.isUser = isUser
    }
    
    public var body: some View {
        Markdown(text)
            .markdownTheme(isUser ? userTheme : .gitHub)
            .textSelection(.enabled)
    }
    
    private var userTheme: Theme {
        .gitHub
            .text {
                ForegroundColor(.white)
            }
    }
}
