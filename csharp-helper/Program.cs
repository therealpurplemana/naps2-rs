using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Threading.Tasks;
using NAPS2Helper.Features;
#if MACOS
using NAPS2.Images.Mac;
#endif
using NAPS2.Scan;

namespace NAPS2Helper
{
    public class Program
    {
        public static async Task<int> Main(string[] args)
        {
            try
            {
                // Print system info in verbose mode
                if (args.Contains("--verbose") || args.Contains("-v"))
                {
                    Console.WriteLine("=== NAPS2 Helper ===");
                    Console.WriteLine($"OS: {RuntimeInformation.OSDescription}");
                    Console.WriteLine($"Framework: {RuntimeInformation.FrameworkDescription}");
                    Console.WriteLine($"Architecture: {RuntimeInformation.ProcessArchitecture}");
                    Console.WriteLine($"Current Directory: {Directory.GetCurrentDirectory()}");
                    Console.WriteLine("==============================");
                }
                
                // Handle different commands
                if (args.Length == 0)
                {
                    // Default behavior - list devices
                    string result = await ScanningHelper.ListDevices(driverName: string.Empty);
                    Console.WriteLine(result);
                    return 0;
                }
                
                string command = args[0].ToLower();
                
                switch (command)
                {
                    case "scan":
                        return await HandleScanCommand(args.Skip(1).ToArray());
                        
                    case "pdf":
                        // Replace with JPEG export
                        return HandleImageExportCommand(args.Skip(1).ToArray());
                        
                    case "ocr":
                        // OCR commands would be implemented here
                        Console.WriteLine("OCR commands not implemented yet");
                        return 1;
                        
                    default:
                        // If no command is recognized, treat the first arg as a driver name
                        string driverName = args[0];
                        string result = await ScanningHelper.ListDevices(driverName);
                        Console.WriteLine(result);
                        return 0;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error: {ex.Message}");
                Console.Error.WriteLine($"Stack trace: {ex.StackTrace}");
                return 1;
            }
        }
        
        private static async Task<int> HandleScanCommand(string[] args)
        {
            if (args.Length == 0)
            {
                Console.WriteLine("Missing scan subcommand. Available: list-devices, to-images");
                return 1;
            }
            
            string subCommand = args[0].ToLower();
            
            switch (subCommand)
            {
                case "list-devices":
                    // Get driver name if provided
                    string driverName = args.Length > 1 ? args[1] : string.Empty;
                    string result = await ScanningHelper.ListDevices(driverName);
                    Console.WriteLine(result);
                    return 0;
                    
                case "to-images":
                    if (args.Length < 2)
                    {
                        Console.WriteLine("Missing device ID");
                        return 1;
                    }
                    
                    string deviceId = args[1];
                    string driver = args.Length > 2 ? args[2] : string.Empty;
                    int dpi = args.Length > 3 && int.TryParse(args[3], out int parsedDpi) ? parsedDpi : 300;
                    string paperSource = args.Length > 4 ? args[4] : string.Empty;
                    
                    string scanResult = await ScanningHelper.ScanToImages(deviceId, driver, dpi, paperSource);
                    Console.WriteLine(scanResult);
                    return 0;
                    
                default:
                    Console.WriteLine($"Unknown scan subcommand: {subCommand}");
                    return 1;
            }
        }

        private static int HandleImageExportCommand(string[] args)
        {
            if (args.Length == 0)
            {
                Console.WriteLine("Missing image export subcommand. Available: jpeg");
                return 1;
            }
            
            string subCommand = args[0].ToLower();
            
            switch (subCommand)
            {
                case "jpeg":
                    if (args.Length < 3)
                    {
                        Console.WriteLine("Missing arguments. Usage: pdf jpeg <output_directory> <image_path1> [<image_path2> ...]");
                        return 1;
                    }
                    
                    string outputDir = args[1];
                    var imagePaths = args.Skip(2).ToList();
                    
                    string result = ScanningHelper.SaveAsJpeg(imagePaths, outputDir);
                    Console.WriteLine(result);
                    return 0;
                    
                default:
                    Console.WriteLine($"Unknown image export subcommand: {subCommand}");
                    return 1;
            }
        }
    }
} 