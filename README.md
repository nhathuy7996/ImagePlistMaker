# Plist Creator VSCode Extension

![Plist Creator Icon](images/icon.png)

A VSCode extension that helps you create plist files from sprite sheets by specifying the number of rows and columns. Perfect for game developers working with sprite animations in Cocos2d-x or similar game engines.

## Features

- 🖼️ Create plist files from sprite sheets
- 📊 Visual grid preview with frame information
- 🔄 Support for PNG, JPG, and JPEG images
- 📏 Specify number of rows and columns
- 👀 Live preview of frame positions
- 📝 Automatic plist file generation
- 🖱️ Right-click menu integration in VSCode explorer

## Installation

### From VSIX
1. Download the latest `.vsix` file from the releases
2. Open VSCode
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows/Linux)
4. Type "Install from VSIX"
5. Select the downloaded `.vsix` file
6. Restart VSCode

### From Source
1. Clone this repository
2. Run `npm install` to install dependencies
3. Press F5 in VSCode to start debugging
4. In the new VSCode window, the extension will be installed

## Usage

1. Right-click on an image file in the VSCode explorer
2. Select "Create Plist from Sprite Sheet"
3. In the preview panel:
   - Enter the number of rows and columns
   - Click "Update Preview" to see the grid
   - Click on any frame to see its details
4. Click "Create Plist" to generate the file
5. Choose where to save the plist file
6. The generated plist file will be opened automatically

## Preview

![Preview](images/preview.png)

## Requirements

- VSCode 1.85.0 or higher
- Node.js and npm

## Extension Settings

This extension does not contribute any settings.

## Known Issues

None at the moment.

## Release Notes

### 0.0.2
- Replaced Sharp with image-size for better compatibility
- Added visual grid preview
- Added frame information display
- Improved error handling

### 0.0.1
- Initial release of Plist Creator

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 