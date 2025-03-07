# NAPS2 Rust Binding POC

This project demonstrates a minimal Proof of Concept for binding Rust to NAPS2.Sdk on macOS. It shows how to list available scanning devices using the macOS-compatible Apple driver.

## Project Structure

- `csharp-helper/`: A small C# application that uses NAPS2.Sdk to list available devices
- `src/`: Rust code that invokes the C# helper and parses its output

## Requirements

- Rust (latest stable)
- .NET 8.0 SDK
- macOS system
- NAPS2 repository

## Setup and Build

1. Make sure .NET 8.0 SDK is installed on your system
2. Compile the C# helper application:

```bash
cd csharp-helper
dotnet build
```

3. Build and run the Rust application:

```bash
cargo run
```

## How it Works

Instead of trying to directly bind Rust to the .NET library (which would be complex), this POC takes a simpler approach:

1. A small C# application uses NAPS2.Sdk to list available devices and outputs the result as JSON
2. The Rust application executes this helper and parses the JSON output
3. This provides a clean, safe interface between Rust and the NAPS2 library

## Extending

To add more NAPS2.Sdk features:

1. Extend the C# helper application with the desired functionality
2. Update the Rust code to invoke the helper with appropriate parameters
3. Parse and process the results in Rust

## Notes

- This approach separates the concerns: .NET handles the NAPS2.Sdk integration, Rust handles the application logic
- For production use, you'd want to add more robust error handling, logging, and configuration options
- The helper executable path is hardcoded for simplicity but should be configurable in a real application 