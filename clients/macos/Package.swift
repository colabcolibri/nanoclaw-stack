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
    dependencies: [],
    targets: [
        .executableTarget(
            name: "BaraoApp",
            dependencies: [],
            path: "Sources/BaraoApp"
        )
    ]
)
