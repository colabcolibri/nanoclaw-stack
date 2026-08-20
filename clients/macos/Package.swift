// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "BaraoApp",
    defaultLocalization: "pt-BR",
    platforms: [
        .macOS(.v13)
    ],
    products: [
        .executable(
            name: "Barao",
            targets: ["BaraoApp"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/gonzalonunez/markdown-ui", from: "2.1.0")
    ],
    targets: [
        .executableTarget(
            name: "BaraoApp",
            dependencies: [
                .product(name: "MarkdownUI", package: "markdown-ui")
            ],
            path: "Sources/BaraoApp"
        )
    ]
)
