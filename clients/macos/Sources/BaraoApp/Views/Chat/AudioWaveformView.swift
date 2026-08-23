import SwiftUI

public struct AudioWaveformView: View {
    public let audioLevel: Float
    
    public init(audioLevel: Float) {
        self.audioLevel = audioLevel
    }
    
    public var body: some View {
        HStack(spacing: 4) {
            ForEach(0..<12, id: \.self) { i in
                RoundedRectangle(cornerRadius: 2)
                    .fill(Color.red)
                    .frame(
                        width: 3,
                        height: CGFloat(max(4.0, Double(audioLevel) * Double((i % 4) + 1) * 7.0))
                    )
                    .animation(.easeOut(duration: 0.08), value: audioLevel)
            }
        }
        .frame(height: 36)
    }
}
