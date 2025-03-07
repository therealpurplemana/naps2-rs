//! Rust bindings for NAPS2.Ocr namespace

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};
use std::process::Command;
use serde::{Deserialize, Serialize};
use crate::bindings::error::Naps2Error;

/// OCR language
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct OcrLanguage {
    pub code: String,
    pub name: String,
}

/// Client for OCR operations
pub struct OcrClient {
    helper_path: PathBuf,
}

impl OcrClient {
    /// Create a new OCR client with the path to the helper application
    pub fn new(helper_path: PathBuf) -> Self {
        Self { helper_path }
    }
    
    /// Get the list of available OCR languages
    pub fn get_languages(&self) -> Result<Vec<OcrLanguage>> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args(["ocr", "languages"]);
        
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
        let languages: Vec<OcrLanguage> = serde_json::from_str(&stdout)
            .map_err(|e| Naps2Error::HelperOutputError(format!("JSON parse error: {}", e)))?;
            
        Ok(languages)
    }
    
    /// Perform OCR on an image
    pub fn recognize<P: AsRef<Path>>(&self, image_path: P, language: &str) -> Result<String> {
        let mut cmd = Command::new(&self.helper_path);
        cmd.args([
            "ocr", 
            "recognize", 
            image_path.as_ref().to_string_lossy().as_ref(),
            language
        ]);
        
        // Execute the helper application
        let output = cmd.output()
            .with_context(|| format!("Failed to execute helper at {:?}", self.helper_path))?;
            
        // Check if the command was successful
        if !output.status.success() {
            let error_message = String::from_utf8_lossy(&output.stderr).to_string();
            return Err(Naps2Error::HelperExecutionError(error_message).into());
        }
        
        // Get the text output
        let text = String::from_utf8_lossy(&output.stdout).to_string();
        Ok(text)
    }
}
