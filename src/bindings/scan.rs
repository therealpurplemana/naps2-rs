//! Rust bindings for NAPS2.Scan namespace

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Command;
use crate::bindings::error::Naps2Error;

/// Supported scanner drivers
#[derive(Debug, Clone, Copy)]
pub enum Driver {
    Default,
    Apple,
    Sane,
    Escl,
    Wia,    // Windows-only
    Twain,  // Windows-only
}

impl Driver {
    /// Convert to string for passing to the C# helper
    pub fn to_string(&self) -> &'static str {
        match self {
            Driver::Default => "Default",
            Driver::Apple => "Apple",
            Driver::Sane => "Sane",
            Driver::Escl => "Escl",
            Driver::Wia => "Wia",
            Driver::Twain => "Twain",
        }
    }
    
    /// Get all drivers available on macOS
    pub fn mac_drivers() -> Vec<Driver> {
        vec![Driver::Default, Driver::Apple, Driver::Sane, Driver::Escl]
    }
}

/// Paper source for scanning
#[derive(Debug, Clone, Copy)]
pub enum PaperSource {
    Flatbed,
    Feeder,
    Duplex,
}

impl PaperSource {
    /// Convert to string for passing to the C# helper
    pub fn to_string(&self) -> &'static str {
        match self {
            PaperSource::Flatbed => "Flatbed",
            PaperSource::Feeder => "Feeder",
            PaperSource::Duplex => "Duplex",
        }
    }
}

/// Scanner device information
#[derive(Debug, Deserialize, Serialize)]
pub struct ScannerDevice {
    #[serde(rename = "Id")]
    pub id: String,
    #[serde(rename = "Name")]
    pub name: String,
    #[serde(rename = "Driver")]
    pub driver: String,
}

/// Result of a scanning operation
#[derive(Debug, Deserialize, Serialize)]
pub struct ScanResult {
    #[serde(rename = "ImagePaths")]
    pub image_paths: Vec<String>,
    #[serde(rename = "TempDirectory")]
    pub temp_directory: String,
}

/// Client for scanning operations
pub struct ScanClient {
    helper_path: PathBuf,
}

impl ScanClient {
    /// Create a new scan client with the path to the helper application
    pub fn new(helper_path: PathBuf) -> Self {
        Self { helper_path }
    }
    
    /// Get a list of available scanning devices with a specific driver
    pub fn get_devices_with_driver(&self, driver: Option<Driver>) -> Result<Vec<ScannerDevice>> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args(["scan", "list-devices"]);
        
        // Add driver argument if specified
        if let Some(drv) = driver {
            cmd.arg(drv.to_string());
        }
        
        // Execute the helper application
        let output = cmd.output()
            .with_context(|| format!("Failed to execute helper at {:?}", self.helper_path))?;
            
        // Check if the command was successful
        if !output.status.success() {
            let error_message = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(Naps2Error::HelperExecutionError(error_message).into());
        }
        
        // Parse the JSON output
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let devices: Vec<ScannerDevice> = serde_json::from_str(&stdout)
            .map_err(|e| Naps2Error::HelperOutputError(format!("JSON parse error: {}", e)))?;
            
        Ok(devices)
    }
    
    /// Get a list of available scanning devices (using all drivers)
    pub fn get_devices(&self) -> Result<Vec<ScannerDevice>> {
        self.get_devices_with_driver(None)
    }
    
    /// Scan using the specified device and save to images
    pub fn scan_to_images(&self, device_id: &str, driver: Option<Driver>, dpi: u32, 
                          paper_source: Option<PaperSource>) -> Result<ScanResult> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args(["scan", "to-images", device_id]);
        
        // Add driver argument if specified
        if let Some(drv) = driver {
            cmd.arg(drv.to_string());
        }
        
        // Add DPI
        cmd.arg(dpi.to_string());
        
        // Add paper source if specified
        if let Some(source) = paper_source {
            cmd.arg(source.to_string());
        }
        
        // Execute the helper application
        let output = cmd.output()
            .with_context(|| format!("Failed to execute helper at {:?}", self.helper_path))?;
            
        // Check if the command was successful
        if !output.status.success() {
            let error_message = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(Naps2Error::HelperExecutionError(error_message).into());
        }
        
        // Parse the JSON output
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let result: ScanResult = serde_json::from_str(&stdout)
            .map_err(|e| Naps2Error::HelperOutputError(format!("JSON parse error: {}", e)))?;
            
        Ok(result)
    }
}
