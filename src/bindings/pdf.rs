//! Rust bindings for NAPS2.Pdf namespace

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::Command;
use crate::bindings::error::Naps2Error;

/// Client for PDF operations
pub struct PdfClient {
    helper_path: PathBuf,
}

impl PdfClient {
    /// Create a new PDF client with the path to the helper application
    pub fn new(helper_path: PathBuf) -> Self {
        Self { helper_path }
    }
    
    /// Export a collection of images to a PDF file
    pub fn export_pdf<P: AsRef<Path>>(&self, output_path: P, image_paths: &[String]) -> Result<()> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args(["pdf", "export", output_path.as_ref().to_string_lossy().as_ref()]);
        
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
            return Err(Naps2Error::HelperExecutionError(error_message).into());
        }
        
        Ok(())
    }
    
    /// Import a PDF file into a collection of images
    pub fn import_pdf<P: AsRef<Path>>(&self, pdf_path: P) -> Result<Vec<String>> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args(["pdf", "import", pdf_path.as_ref().to_string_lossy().as_ref()]);
        
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
        let image_paths: Vec<String> = serde_json::from_str(&stdout)
            .map_err(|e| Naps2Error::HelperOutputError(format!("JSON parse error: {}", e)))?;
            
        Ok(image_paths)
    }
}
