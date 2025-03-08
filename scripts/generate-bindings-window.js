#!/usr/bin/env node

/**
 * NAPS2.Sdk Rust Binding Generator
 * 
 * This script analyzes the NAPS2.Sdk .NET assembly and generates Rust bindings
 * that interface with our C# helper application.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

// Configuration
const config = {
  // Path to the NAPS2.Sdk assembly
  sdkAssemblyPath: process.platform === 'win32' ? path.resolve(__dirname, '../vendor/naps2/NAPS2.Sdk/bin/Debug/net6/NAPS2.Sdk.dll') : path.resolve(__dirname, '../vendor/naps2/NAPS2.Sdk/bin/Debug/net8-macos/NAPS2.Sdk.dll'),
  // Path to the C# helper project
  helperProjectPath: path.resolve(__dirname, '../csharp-helper'),
  // Output directory for generated Rust code
  outputDir: path.resolve(__dirname, '../src/bindings'),
  // List of namespaces to generate bindings for
  namespaces: [
    'NAPS2.Scan',
    'NAPS2.Images',
    'NAPS2.Pdf',
    'NAPS2.Ocr'
  ]
};

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true });
}

/**
 * Generate Rust bindings for the NAPS2.Sdk
 */
function generateBindings() {
  console.log('🔍 Analyzing NAPS2.Sdk assembly...');
  
  // Ensure the SDK assembly exists
  if (!fs.existsSync(config.sdkAssemblyPath)) {
    console.error(`❌ SDK assembly not found at ${config.sdkAssemblyPath}`);
    console.error('   Build the NAPS2.Sdk project first.');
    process.exit(1);
  }
  
  // Create helper application modules for each feature
  createHelperModules();
  
  // Generate Rust code for each namespace
  for (const namespace of config.namespaces) {
    generateNamespaceBindings(namespace);
  }
  
  // Generate the main mod.rs file
  generateModFile();
  
  console.log('✅ Binding generation completed successfully!');
}

/**
 * Create C# helper modules for each feature
 */
function createHelperModules() {
  console.log('📝 Creating C# helper modules...');
  
  // Create directories for different features
  const helperSrcDir = path.join(config.helperProjectPath, 'Features');
  if (!fs.existsSync(helperSrcDir)) {
    fs.mkdirSync(helperSrcDir, { recursive: true });
  }
  
  // Create a module for scanning functionality with platform-specific code
  const scanHelperCode = process.platform === 'win32' 
    ? `using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using System.Reflection;
using NAPS2.Images;
using NAPS2.Scan;
using NAPS2.Images.Gdi;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.DependencyInjection;

namespace NAPS2Helper.Features
{
    public static class ScanningHelper
    {
        private static readonly string LogPath = Path.Combine(
            Path.GetDirectoryName(Assembly.GetExecutingAssembly().Location) ?? "", 
            "naps2_helper.log");
            
        static ScanningHelper()
        {
            // Ensure log directory exists and write a startup entry
            try
            {
                var logDir = Path.GetDirectoryName(LogPath);
                if (!string.IsNullOrEmpty(logDir) && !Directory.Exists(logDir))
                {
                    Directory.CreateDirectory(logDir);
                }
                File.AppendAllText(LogPath, $"[{DateTime.Now}] Application started\\n");
            }
            catch
            {
                // Ignore startup logging errors
            }
        }
            
        private static ILoggerFactory CreateLoggerFactory()
        {
            return LoggerFactory.Create(builder => 
                builder.AddSimpleFileLogger(LogPath).SetMinimumLevel(LogLevel.Debug));
        }

        public static async Task<string> ListDevices(string driverName)
        {
            try
            {
                using var scanningContext = new ScanningContext(new GdiImageContext());
                
                Driver driver = Driver.Default;
                if (!string.IsNullOrEmpty(driverName) && Enum.TryParse<Driver>(driverName, true, out var parsedDriver))
                {
                    driver = parsedDriver;
                }
                
                var options = new ScanOptions { Driver = driver };
                
                // Configure driver-specific options
                if (driver == Driver.Twain)
                {
                    if (Environment.Is64BitProcess)
                    {
                        // We're running as 64-bit, but need 32-bit access to TWAIN
                        File.AppendAllText(LogPath, $"[{DateTime.Now}] Avoiding TWAIN in 64-bit mode\\n");
                        return "[]"; // Return empty device list as TWAIN needs extra setup
                    }
                    
                    options.TwainOptions = new TwainOptions
                    {
                        Dsm = TwainDsm.New, // Use basic DSM for 32-bit
                        TransferMode = TwainTransferMode.Memory,
                        IncludeWiaDevices = true
                    };
                }
                
                var controller = new ScanController(scanningContext);
                var devices = await controller.GetDeviceList(options);
                
                var deviceList = new List<object>();
                foreach (var device in devices)
                {
                    deviceList.Add(new
                    {
                        Id = device.ID,
                        Name = device.Name,
                        Driver = device.Driver.ToString()
                    });
                }
                
                return JsonSerializer.Serialize(deviceList, new JsonSerializerOptions
                {
                    WriteIndented = true
                });
            }
            catch (Exception ex)
            {
                // Log error to file without affecting stdout
                File.AppendAllText(LogPath, $"[ERROR] {DateTime.Now}: {ex.Message}\\n{ex.StackTrace}\\n\\n");
                
                // Return empty array to avoid JSON parsing errors
                return "[]";
            }
        }
        
        public static async Task<string> ScanToImages(string deviceId, string driverName, int dpi, string paperSource)
        {
            try
            {
                using var scanningContext = new ScanningContext(new GdiImageContext());
                
                // Find the device by ID
                Driver driver = Driver.Default;
                if (!string.IsNullOrEmpty(driverName) && Enum.TryParse<Driver>(driverName, true, out var parsedDriver))
                {
                    driver = parsedDriver;
                }
                
                var controller = new ScanController(scanningContext);
                
                var options = new ScanOptions 
                { 
                    Driver = driver,
                    Dpi = dpi
                };
                
                // Configure driver-specific options
                if (driver == Driver.Twain)
                {
                    if (Environment.Is64BitProcess)
                    {
                        // TWAIN scanning is complex in 64-bit mode
                        throw new NotSupportedException("TWAIN scanning from 64-bit mode is not supported. Please use WIA driver instead.");
                    }
                    
                    options.TwainOptions = new TwainOptions
                    {
                        Dsm = TwainDsm.New, // Use basic DSM for 32-bit
                        TransferMode = TwainTransferMode.Memory,
                        IncludeWiaDevices = true
                    };
                }
                
                // Set paper source if provided
                if (!string.IsNullOrEmpty(paperSource) && Enum.TryParse<PaperSource>(paperSource, true, out var parsedSource))
                {
                    options.PaperSource = parsedSource;
                }
                
                // Find the device by ID
                var devices = await controller.GetDeviceList(options);
                var device = devices.Find(d => d.ID == deviceId);
                
                if (device == null)
                {
                    throw new Exception($"Device with ID {deviceId} not found");
                }
                
                options.Device = device;
                
                // Create a temp directory for images
                var tempDir = Path.GetTempPath();
                var sessionDir = Path.Combine(tempDir, $"naps2_scan_{Guid.NewGuid()}");
                Directory.CreateDirectory(sessionDir);
                
                // Scan and save images
                int i = 1;
                var imagePaths = new List<string>();
                
                await foreach (var image in controller.Scan(options))
                {
                    var imagePath = Path.Combine(sessionDir, $"page{i++}.jpg");
                    var renderableImage = (IRenderableImage)image;
                    ImageExtensions.Save(renderableImage, imagePath, ImageFileFormat.Jpeg);
                    imagePaths.Add(imagePath);
                }
                
                return JsonSerializer.Serialize(new
                {
                    ImagePaths = imagePaths,
                    TempDirectory = sessionDir
                }, new JsonSerializerOptions
                {
                    WriteIndented = true
                });
            }
            catch (Exception ex)
            {
                // Log error to file without affecting stdout
                File.AppendAllText(LogPath, $"[ERROR] {DateTime.Now}: {ex.Message}\\n{ex.StackTrace}\\n\\n");
                
                // Return error JSON
                return JsonSerializer.Serialize(new
                {
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                }, new JsonSerializerOptions
                {
                    WriteIndented = true
                });
            }
        }

        public static string SaveAsJpeg(List<string> imagePaths, string outputDir)
        {
            try
            {
                // Ensure output directory exists
                if (!Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }
                
                // Initialize the scanning context
                using var scanningContext = new ScanningContext(new GdiImageContext());
                var imageContext = scanningContext.ImageContext;
                
                // Output file paths
                var outputFiles = new List<string>();
                int index = 1;
                
                // Process each input image
                foreach (var imagePath in imagePaths)
                {
                    if (File.Exists(imagePath))
                    {
                        try
                        {
                            // Load the image
                            var image = imageContext.Load(imagePath);
                            
                            // Save as JPEG with a numbered filename
                            var outputPath = Path.Combine(outputDir, $"image_{index:D3}.jpg");
                            var renderableImage = (IRenderableImage)image;
                            ImageExtensions.Save(renderableImage, outputPath, ImageFileFormat.Jpeg);
                            outputFiles.Add(outputPath);
                            
                            // Clean up
                            image.Dispose();
                            index++;
                        }
                        catch (Exception ex)
                        {
                            File.AppendAllText(LogPath, $"[ERROR] {DateTime.Now}: Error processing image {imagePath}: {ex.Message}\\n");
                        }
                    }
                }
                
                // Return success result with output file paths
                return JsonSerializer.Serialize(new
                {
                    Success = true,
                    Directory = outputDir,
                    Files = outputFiles,
                    Count = outputFiles.Count
                }, new JsonSerializerOptions { WriteIndented = true });
            }
            catch (Exception ex)
            {
                // Log error to file without affecting stdout
                File.AppendAllText(LogPath, $"[ERROR] {DateTime.Now}: {ex.Message}\\n{ex.StackTrace}\\n\\n");
                
                // Return error result
                return JsonSerializer.Serialize(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                }, new JsonSerializerOptions { WriteIndented = true });
            }
        }
    }
    
    // Simplified file logger implementation
    public static class FileLoggerExtensions
    {
        public static ILoggingBuilder AddSimpleFileLogger(this ILoggingBuilder builder, string filePath)
        {
            builder.Services.AddSingleton<ILoggerProvider>(new SimpleFileLoggerProvider(filePath));
            return builder;
        }
    }
    
    public class SimpleFileLoggerProvider : ILoggerProvider
    {
        private readonly string _filePath;
        
        public SimpleFileLoggerProvider(string filePath)
        {
            _filePath = filePath;
        }
        
        public ILogger CreateLogger(string categoryName)
        {
            return new SimpleFileLogger(_filePath);
        }
        
        public void Dispose() { }
    }
    
    public class SimpleFileLogger : ILogger
    {
        private readonly string _filePath;
        
        public SimpleFileLogger(string filePath)
        {
            _filePath = filePath;
        }
        
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
        {
            return null;
        }
        
        public bool IsEnabled(LogLevel logLevel) => true;
        
        public void Log<TState>(
            LogLevel logLevel, 
            EventId eventId, 
            TState state, 
            Exception? exception, 
            Func<TState, Exception?, string> formatter)
        {
            try
            {
                var message = formatter(state, exception);
                var line = $"[{DateTime.Now}][{logLevel}] {message}";
                if (exception != null)
                {
                    line += $"\\n{exception}";
                }
                File.AppendAllText(_filePath, line + "\\n");
            }
            catch
            {
                // Suppress logging errors
            }
        }
    }
}`
    : `using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;
using System.Linq;
using NAPS2.Images;
using NAPS2.Images.Mac;
using NAPS2.Scan;

namespace NAPS2Helper.Features
{
    public static class ScanningHelper
    {
        public static async Task<string> ListDevices(string driverName)
        {
            using var scanningContext = new ScanningContext(new MacImageContext());
            var controller = new ScanController(scanningContext);
            
            Driver driver = Driver.Default;
            if (!string.IsNullOrEmpty(driverName) && Enum.TryParse<Driver>(driverName, true, out var parsedDriver))
            {
                driver = parsedDriver;
            }
            
            var options = new ScanOptions { Driver = driver };
            var devices = await controller.GetDeviceList(options);
            
            var deviceList = new List<object>();
            foreach (var device in devices)
            {
                deviceList.Add(new
                {
                    Id = device.ID,
                    Name = device.Name,
                    Driver = device.Driver.ToString()
                });
            }
            
            return JsonSerializer.Serialize(deviceList, new JsonSerializerOptions
            {
                WriteIndented = true
            });
        }
        
        public static async Task<string> ScanToImages(string deviceId, string driverName, int dpi, string paperSource)
        {
            using var scanningContext = new ScanningContext(new MacImageContext());
            var controller = new ScanController(scanningContext);
            
            // Find the device by ID
            Driver driver = Driver.Default;
            if (!string.IsNullOrEmpty(driverName) && Enum.TryParse<Driver>(driverName, true, out var parsedDriver))
            {
                driver = parsedDriver;
            }
            
            var options = new ScanOptions 
            { 
                Driver = driver,
                Dpi = dpi
            };
            
            // Set paper source if provided
            if (!string.IsNullOrEmpty(paperSource) && Enum.TryParse<PaperSource>(paperSource, true, out var parsedSource))
            {
                options.PaperSource = parsedSource;
            }
            
            // Find the device by ID
            var devices = await controller.GetDeviceList(options);
            var device = devices.Find(d => d.ID == deviceId);
            
            if (device == null)
            {
                throw new Exception($"Device with ID {deviceId} not found");
            }
            
            options.Device = device;
            
            // Create a temp directory for images
            var tempDir = Path.GetTempPath();
            var sessionDir = Path.Combine(tempDir, $"naps2_scan_{Guid.NewGuid()}");
            Directory.CreateDirectory(sessionDir);
            
            // Scan and save images
            int i = 1;
            var imagePaths = new List<string>();
            
            await foreach (var image in controller.Scan(options))
            {
                var imagePath = Path.Combine(sessionDir, $"page{i++}.jpg");
                var renderableImage = (IRenderableImage)image;
                ImageExtensions.Save(renderableImage, imagePath, ImageFileFormat.Jpeg);
                imagePaths.Add(imagePath);
            }
            
            return JsonSerializer.Serialize(new
            {
                ImagePaths = imagePaths,
                TempDirectory = sessionDir
            }, new JsonSerializerOptions
            {
                WriteIndented = true
            });
        }
        
        public static string SaveAsJpeg(List<string> imagePaths, string outputDir)
        {
            try
            {
                // Ensure output directory exists
                if (!Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }
                
                // Initialize the scanning context
                using var scanningContext = new ScanningContext(new MacImageContext());
                var imageContext = scanningContext.ImageContext;
                
                // Output file paths
                var outputFiles = new List<string>();
                int index = 1;
                
                // Process each input image
                foreach (var imagePath in imagePaths)
                {
                    if (File.Exists(imagePath))
                    {
                        try
                        {
                            // Load the image
                            var image = imageContext.Load(imagePath);
                            
                            // Save as JPEG with a numbered filename
                            var outputPath = Path.Combine(outputDir, $"image_{index:D3}.jpg");
                            var renderableImage = (IRenderableImage)image;
                            ImageExtensions.Save(renderableImage, outputPath, ImageFileFormat.Jpeg);
                            outputFiles.Add(outputPath);
                            
                            // Clean up
                            image.Dispose();
                            index++;
                        }
                        catch (Exception ex)
                        {
                            Console.WriteLine($"Error processing image {imagePath}: {ex.Message}");
                        }
                    }
                }
                
                // Return success result with output file paths
                return JsonSerializer.Serialize(new
                {
                    Success = true,
                    Directory = outputDir,
                    Files = outputFiles,
                    Count = outputFiles.Count
                }, new JsonSerializerOptions { WriteIndented = true });
            }
            catch (Exception ex)
            {
                // Return error result
                return JsonSerializer.Serialize(new
                {
                    Success = false,
                    Error = ex.Message,
                    StackTrace = ex.StackTrace
                }, new JsonSerializerOptions { WriteIndented = true });
            }
        }
    }
}`;
  
  fs.writeFileSync(path.join(helperSrcDir, 'ScanningHelper.cs'), scanHelperCode);
  
  // We'd add more helper modules here for PDFs, OCR, etc.
  console.log('   Created ScanningHelper.cs');
}

/**
 * Generate Rust bindings for a specific NAPS2.Sdk namespace
 */
function generateNamespaceBindings(namespace) {
  console.log(`📦 Generating bindings for ${namespace}...`);
  
  const shortName = namespace.split('.').pop().toLowerCase();
  const outputFile = path.join(config.outputDir, `${shortName}.rs`);
  
  // Generate Rust code based on the namespace
  let rustCode = '';
  
  if (namespace === 'NAPS2.Scan') {
    rustCode = generateScanBindings();
  } else if (namespace === 'NAPS2.Images') {
    rustCode = generateImagesBindings();
  } else if (namespace === 'NAPS2.Pdf') {
    rustCode = generatePdfBindings();
  } else if (namespace === 'NAPS2.Ocr') {
    rustCode = generateOcrBindings();
  }
  
  fs.writeFileSync(outputFile, rustCode);
  console.log(`   Created ${outputFile}`);
}

/**
 * Generate Rust bindings for NAPS2.Scan namespace
 */
function generateScanBindings() {
  return `//! Rust bindings for NAPS2.Scan namespace

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
    
    /// Get all drivers available on Windows
    pub fn windows_drivers() -> Vec<Driver> {
        vec![Driver::Default, Driver::Wia, Driver::Twain]
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
`;
}

/**
 * Generate Rust bindings for NAPS2.Images namespace
 */
function generateImagesBindings() {
  return `//! Rust bindings for NAPS2.Images namespace

use anyhow::Result;
use std::path::Path;

/// Interface for image operations
pub trait Image {
    /// Save the image to a file
    fn save<P: AsRef<Path>>(&self, path: P) -> Result<()>;
    
    /// Get the width of the image
    fn width(&self) -> u32;
    
    /// Get the height of the image
    fn height(&self) -> u32;
}

/// Placeholder for actual image implementation
/// In a real implementation, this would either wrap the C# image or use a Rust image library
pub struct Naps2Image {
    path: String,
    width: u32,
    height: u32,
}

impl Naps2Image {
    /// Create a new image from a file
    pub fn from_file<P: AsRef<Path>>(path: P) -> Result<Self> {
        // In a real implementation, we'd read the image metadata
        // For now, just return a placeholder
        Ok(Self {
            path: path.as_ref().to_string_lossy().to_string(),
            width: 0,
            height: 0,
        })
    }
}

impl Image for Naps2Image {
    fn save<P: AsRef<Path>>(&self, path: P) -> Result<()> {
        // In a real implementation, we'd call the C# helper to save the image
        // For now, just return Ok
        Ok(())
    }
    
    fn width(&self) -> u32 {
        self.width
    }
    
    fn height(&self) -> u32 {
        self.height
    }
}
`;
}

/**
 * Generate Rust bindings for NAPS2.Pdf namespace
 */
function generatePdfBindings() {
  return `//! Rust bindings for NAPS2.Pdf namespace

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
`;
}

/**
 * Generate Rust bindings for NAPS2.Ocr namespace
 */
function generateOcrBindings() {
  return `//! Rust bindings for NAPS2.Ocr namespace

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
`;
}

/**
 * Generate a common error module
 */
function generateErrorModule() {
  const errorCode = `//! Error types for NAPS2 bindings

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
`;

  fs.writeFileSync(path.join(config.outputDir, 'error.rs'), errorCode);
  console.log(`   Created ${path.join(config.outputDir, 'error.rs')}`);
}

/**
 * Generate the mod.rs file for the bindings module
 */
function generateModFile() {
  console.log('📄 Generating mod.rs...');
  
  // Generate error module first
  generateErrorModule();
  
  const modCode = `//! Rust bindings for NAPS2.Sdk

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
}`;

  fs.writeFileSync(path.join(config.outputDir, 'mod.rs'), modCode);
  console.log('   Created mod.rs');
}

// Run the binding generator
generateBindings(); 