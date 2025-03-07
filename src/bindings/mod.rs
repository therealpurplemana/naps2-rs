//! Rust bindings for NAPS2.Sdk

pub mod error;
pub mod scan;
pub mod images;
pub mod pdf;
pub mod ocr;

/// Re-exports of commonly used types
pub use scan::{Driver, PaperSource, ScannerDevice, ScanClient};
pub use pdf::PdfClient;
pub use ocr::{OcrLanguage, OcrClient};

use std::path::PathBuf;
use std::process::Command;
use serde::{Deserialize, Serialize};
use anyhow::{Context, Result};

/// Result of a JPEG save operation
#[derive(Debug, Deserialize, Serialize)]
pub struct JpegSaveResult {
    #[serde(rename = "Success")]
    pub success: bool,
    #[serde(rename = "Directory")]
    pub directory: String,
    #[serde(rename = "Files")]
    pub files: Vec<String>,
    #[serde(rename = "Count")]
    pub count: usize,
    #[serde(rename = "Error", skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Main client for NAPS2.Sdk
pub struct Naps2Client {
    helper_path: PathBuf,
    scan_client: ScanClient,
    pdf_client: PdfClient,
    ocr_client: OcrClient,
}

impl Naps2Client {
    /// Create a new NAPS2 client with the path to the helper application
    pub fn new(helper_path: PathBuf) -> Self {
        Self {
            helper_path: helper_path.clone(),
            scan_client: ScanClient::new(helper_path.clone()),
            pdf_client: PdfClient::new(helper_path.clone()),
            ocr_client: OcrClient::new(helper_path),
        }
    }
    
    /// Get the scan client
    pub fn scan(&self) -> &ScanClient {
        &self.scan_client
    }
    
    /// Get the PDF client
    pub fn pdf(&self) -> &PdfClient {
        &self.pdf_client
    }
    
    /// Get the OCR client
    pub fn ocr(&self) -> &OcrClient {
        &self.ocr_client
    }
    
    /// Save images as JPEG files
    pub fn save_as_jpeg(&self, image_paths: &[String], output_dir: &str) -> Result<JpegSaveResult> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args(["pdf", "jpeg", output_dir]);
        
        // Add image paths
        for path in image_paths {
            cmd.arg(path);
        }
        
        // Execute the helper application
        let output = cmd.output()
            .with_context(|| format!("Failed to execute helper at {:?}", self.helper_path))?;
            
        // Check if the command was successful
        if !output.status.success() {
            let error_message = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(error::Naps2Error::HelperExecutionError(error_message).into());
        }
        
        // Parse the JSON output
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let result: JpegSaveResult = serde_json::from_str(&stdout)
            .map_err(|e| error::Naps2Error::HelperOutputError(format!("JSON parse error: {}", e)))?;
            
        Ok(result)
    }
}