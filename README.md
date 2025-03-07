# NAPS2 Rust Bindings

Rust bindings for [NAPS2](https://github.com/cyanfish/naps2) scanning SDK, providing native document scanning capabilities for macOS applications.

## Platform Support

| Operating System | Architecture | Scanner Drivers | Status |
|-----------------|--------------|-----------------|--------|
| macOS 10.15+    | Apple Silicon (arm64) | Apple ICA, SANE, eSCL | ✅ |
| macOS 10.15+    | Intel (x64) | Apple ICA, SANE, eSCL | ✅ |
| Linux           | x64          | SANE, eSCL | 🚧 Planned |
| Linux           | arm64        | SANE, eSCL | 🚧 Planned |
| Windows         | x64          | WIA, TWAIN, eSCL | 🚧 Planned |
| Windows         | x86          | WIA, TWAIN, eSCL | 🚧 Planned |

## Prerequisites

- Rust toolchain (1.75.0 or later)
- .NET SDK 8.0 or later
- Node.js 14.0 or later (for build scripts)
- macOS 10.15 or later

## Installation

```bash
# Using cargo
cargo add naps2-rust-bindings

# Or add to Cargo.toml
[dependencies]
naps2-rust-bindings = "0.1.0"
```

## Quick Start

```rust
use naps2_rust_bindings::{ScanClient, Driver};
use anyhow::Result;

fn main() -> Result<()> {
    // Create a scan client
    let client = ScanClient::new("path/to/helper".into());

    // List available scanners
    let devices = client.get_devices()?;
    for device in devices {
        println!("Found scanner: {} ({})", device.name, device.id);
    }

    // Scan a document
    if let Some(device) = devices.first() {
        let result = client.scan_to_images(
            &device.id,
            Some(Driver::Apple),
            300,  // DPI
            None, // Default paper source
        )?;

        println!("Scanned {} pages", result.image_paths.len());
    }

    Ok(())
}
```

## Features

- ✨ Native scanning support for macOS
- 🔍 Automatic scanner discovery
- 📄 Multiple page scanning
- 🖼️ Image format conversion
- 📱 Apple Silicon and Intel support
- 🔒 Safe Rust bindings

## Building from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/naps2-rs.git
cd naps2-rs

# Build everything
npm run build

# Run tests
npm test
```

## Documentation

For detailed API documentation, run:
```bash
cargo doc --open
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [NAPS2](https://github.com/cyanfish/naps2) - The core scanning SDK this project builds upon
- [Ben Olden-Cooligan](https://github.com/cyanfish) - Creator of NAPS2

## Status

This project is currently in beta. While it's functional for basic scanning operations, some advanced features are still under development. 