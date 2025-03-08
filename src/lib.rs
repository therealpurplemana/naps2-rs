// Re-export the bindings module
pub mod bindings;
pub use bindings::*;

// Example function to demonstrate usage
pub fn scan_example() -> anyhow::Result<()> {
    use std::path::PathBuf;
    
    // Create a new NAPS2 client
    let helper_path = PathBuf::from("../csharp-helper/bin/Debug/net8.0-macos/osx-arm64/NAPS2Helper.app/Contents/MacOS/NAPS2Helper");
    let client = Naps2Client::new(helper_path);
    
    // Get available scanning devices using the SANE driver (which worked for you)
    println!("Searching for scanners with SANE driver...");
    let devices = client.scan().get_devices_with_driver(Some(Driver::Sane))?;
    
    if devices.is_empty() {
        println!("No scanners found with SANE driver.");
        return Ok(());
    }
    
    // Display found devices
    println!("\nFound {} scanners:", devices.len());
    for (i, device) in devices.iter().enumerate() {
        println!("{}. {} (ID: {}, Driver: {})", 
            i + 1, device.name, device.id, device.driver);
    }
    
    // Use the first device for scanning
    if let Some(device) = devices.first() {
        println!("\nScanning with device: {}", device.name);
        
        // Scan with Feeder source (if available) and 300 DPI
        let scan_result = client.scan().scan_to_images(
            &device.id, 
            Some(Driver::Sane), 
            300, 
            Some(PaperSource::Feeder)
        )?;
        
        // Display results
        println!("\nScan completed! {} pages scanned.", scan_result.image_paths.len());
        println!("Images saved to: {}", scan_result.temp_directory);
        
        // Export to PDF
        let pdf_path = format!("{}/output.pdf", scan_result.temp_directory);
        client.pdf().export_pdf(&pdf_path, &scan_result.image_paths)?;
        
        println!("PDF exported to: {}", pdf_path);
    }
    
    Ok(())
} 