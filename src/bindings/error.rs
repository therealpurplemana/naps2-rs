//! Error types for NAPS2 bindings

use thiserror::Error;

#[derive(Error, Debug)]
pub enum Naps2Error {
    #[error("Failed to execute helper application: {0}")]
    HelperExecutionError(String),
    
    #[error("Failed to parse helper application output: {0}")]
    HelperOutputError(String),
    
    #[error("Device not found: {0}")]
    DeviceNotFoundError(String),
    
    #[error("Scanning failed: {0}")]
    ScanningError(String),
    
    #[error("PDF operation failed: {0}")]
    PdfError(String),
    
    #[error("OCR operation failed: {0}")]
    OcrError(String),
}
