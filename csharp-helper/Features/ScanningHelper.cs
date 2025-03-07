using System;
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
}