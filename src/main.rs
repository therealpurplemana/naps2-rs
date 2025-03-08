use anyhow::Result;
use naps2_poc::{Naps2Client, Driver, PaperSource};
use std::path::PathBuf;

fn main() -> Result<()> {
    // Determine the helper path based on the operating system
    let helper_path = if cfg!(target_os = "windows") {
        PathBuf::from("C:/naps2-rs/csharp-helper/bin/Debug/net9.0-windows7.0/NAPS2Helper.exe")
    } else {
        PathBuf::from("./csharp-helper/bin/Debug/net8.0-macos/osx-arm64/NAPS2Helper.app/Contents/MacOS/NAPS2Helper")
    };
    
    // Create a new NAPS2 client
    let client = Naps2Client::new(helper_path);
    
    println!("NAPS2.Sdk Rust Binding Example");
    println!("==============================");
    
    // Try all compatible drivers to find scanners
    let drivers = if cfg!(target_os = "windows") {
        vec![Driver::Default, Driver::Wia, Driver::Twain]
    } else {
        vec![Driver::Default, Driver::Apple, Driver::Sane, Driver::Escl]
    };

    for driver in drivers {
        println!("\nTrying {} driver:", driver.to_string());
        
        match client.scan().get_devices_with_driver(Some(driver)) {
            Ok(devices) => {
                if devices.is_empty() {
                    println!("No devices found");
                    continue;
                }
                
                println!("Found {} devices:", devices.len());
                for (i, device) in devices.iter().enumerate() {
                    println!("  {}. {} (ID: {})", i + 1, device.name, device.id);
                    
                    // Example: Scan with the first device found
                    if i == 0 {
                        println!("\nWould you like to scan a document with this device? (y/n)");
                        let mut input = String::new();
                        std::io::stdin().read_line(&mut input)?;
                        
                        if input.trim().to_lowercase() == "y" {
                            println!("Scanning with {}...", device.name);
                            
                            // Choose paper source
                            println!("Choose paper source:");
                            println!("  1. Flatbed");
                            println!("  2. Feeder");
                            println!("  3. Duplex");
                            
                            let mut source_input = String::new();
                            std::io::stdin().read_line(&mut source_input)?;
                            
                            let paper_source = match source_input.trim() {
                                "1" => PaperSource::Flatbed,
                                "2" => PaperSource::Feeder,
                                "3" => PaperSource::Duplex,
                                _ => PaperSource::Flatbed, // Default
                            };
                            
                            println!("Using {:?} source", paper_source);
                            
                            // Perform scan
                            match client.scan().scan_to_images(&device.id, Some(driver), 300, Some(paper_source)) {
                                Ok(scan_result) => {
                                    println!("Scan complete! {} pages scanned", scan_result.image_paths.len());
                                    println!("Images saved to: {}", scan_result.temp_directory);
                                    
                                    // Let's save the images to a nicer directory with better names
                                    let output_dir = format!("{}/processed_images", scan_result.temp_directory);
                                    print!("Would you like to save processed copies of the images? (y/n): ");
                                    let mut input = String::new();
                                    std::io::stdin().read_line(&mut input)?;
                                    
                                    if input.trim().to_lowercase() == "y" {
                                        println!("Saving processed images to: {}", output_dir);
                                        
                                        match client.save_as_jpeg(&scan_result.image_paths, &output_dir) {
                                            Ok(result) => {
                                                println!("Successfully saved {} images to {}", 
                                                    result.count, result.directory);
                                            },
                                            Err(e) => println!("Error saving images: {}", e),
                                        }
                                    }
                                },
                                Err(e) => println!("Error scanning: {}", e),
                            }
                        }
                    }
                }
            },
            Err(e) => println!("Error: {}", e),
        }
    }
    
    Ok(())
}
