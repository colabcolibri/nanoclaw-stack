import SwiftUI
import AppKit

public struct RobotAvatarView: View {
    public let size: CGFloat
    
    public init(size: CGFloat = 28) {
        self.size = size
    }
    
    private var loadedImage: NSImage? {
        if let img = NSImage(named: "AppIcon") { return img }
        if let path = Bundle.main.path(forResource: "AppIcon", ofType: "png"),
           let img = NSImage(contentsOfFile: path) { return img }
        if let path = Bundle.main.path(forResource: "AppIcon_128", ofType: "png"),
           let img = NSImage(contentsOfFile: path) { return img }
        if let path = Bundle.main.path(forResource: "AppIcon_64", ofType: "png"),
           let img = NSImage(contentsOfFile: path) { return img }
        return nil
    }
    
    public var body: some View {
        if let img = loadedImage {
            Image(nsImage: img)
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: size, height: size)
                .clipShape(RoundedRectangle(cornerRadius: size * 0.22))
                .shadow(color: Color.black.opacity(0.15), radius: 2, x: 0, y: 1)
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: size * 0.22)
                    .fill(
                        LinearGradient(
                            colors: [Color.blue.opacity(0.8), Color.indigo],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: size, height: size)
                
                Image(systemName: "crown.fill")
                    .font(.system(size: size * 0.5))
                    .foregroundColor(.white)
            }
        }
    }
}
