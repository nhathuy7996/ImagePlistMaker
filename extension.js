const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

/**
 * Validates and gets image metadata
 * @param {string} imagePath Path to the image file
 * @returns {Promise<{width: number, height: number}>} Image dimensions
 */
async function getImageMetadata(imagePath) {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
        throw new Error(`File does not exist: ${imagePath}`);
    }

    // Check if file is readable
    try {
        fs.accessSync(imagePath, fs.constants.R_OK);
    } catch (error) {
        throw new Error(`Cannot read file: ${error.message}`);
    }

    // Try to get image metadata
    try {
        const metadata = await sharp(imagePath).metadata();
        if (!metadata || !metadata.width || !metadata.height) {
            throw new Error('Invalid image metadata');
        }
        return metadata;
    } catch (error) {
        throw new Error(`Failed to read image metadata: ${error.message}`);
    }
}

/**
 * Creates a plist file from an image with specified rows and columns
 * @param {string} imagePath Path to the image file
 * @param {number} rows Number of rows
 * @param {number} cols Number of columns
 * @param {string} outputPath Path where to save the plist file
 */
async function createPlist(imagePath, rows, cols, outputPath) {
    // Get image metadata
    const metadata = await sharp(imagePath).metadata();
    const totalWidth = metadata.width;
    const totalHeight = metadata.height;
    
    // Calculate frame dimensions
    const frameWidth = Math.floor(totalWidth / cols);
    const frameHeight = Math.floor(totalHeight / rows);
    
    // Create frames dictionary
    const frames = {};
    
    // Add frames based on grid
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Calculate frame position
            const x = col * frameWidth;
            const y = row * frameHeight;
            
            // Generate frame name
            const frameName = `frame_${row}_${col}.png`;
            
            // Create frame data
            frames[frameName] = {
                frame: `{{${x},${y}},{${frameWidth},${frameHeight}}}`,
                offset: "{0,0}",
                rotated: false,
                sourceColorRect: `{{0,0},{${frameWidth},${frameHeight}}}`,
                sourceSize: `{${frameWidth},${frameHeight}}`
            };
        }
    }
    
    // Create metadata
    const metadataObj = {
        format: 2,
        realTextureFileName: path.basename(imagePath),
        size: `{${totalWidth},${totalHeight}}`,
        smartupdate: `$TexturePacker:SmartUpdate:${Date.now()}$`,
        textureFileName: path.basename(imagePath)
    };
    
    // Generate plist content
    let framesContent = '';
    for (const [frameName, frameData] of Object.entries(frames)) {
        framesContent += `
            <key>${frameName}</key>
            <dict>
                <key>frame</key>
                <string>${frameData.frame}</string>
                <key>offset</key>
                <string>${frameData.offset}</string>
                <key>rotated</key>
                <${frameData.rotated}/>
                <key>sourceColorRect</key>
                <string>${frameData.sourceColorRect}</string>
                <key>sourceSize</key>
                <string>${frameData.sourceSize}</string>
            </dict>`;
    }
    
    // Create the complete plist content
    const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>frames</key>
        <dict>${framesContent}
        </dict>
        <key>metadata</key>
        <dict>
            <key>format</key>
            <integer>2</integer>
            <key>realTextureFileName</key>
            <string>${path.basename(imagePath)}</string>
            <key>size</key>
            <string>{${totalWidth},${totalHeight}}</string>
            <key>smartupdate</key>
            <string>$TexturePacker:SmartUpdate:${Date.now()}$</string>
            <key>textureFileName</key>
            <string>${path.basename(imagePath)}</string>
        </dict>
    </dict>
</plist>`;
    
    // Write the plist file
    fs.writeFileSync(outputPath, plistContent);
}

class PlistCreatorPanel {
    static currentPanel = undefined;
    static viewType = 'plistCreator';

    constructor(panel, extensionUri, imagePath) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.imagePath = imagePath;
        this.disposables = [];

        // Set the webview's initial html content
        this._updateWebview();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'createPlist':
                        try {
                            const outputPath = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.file(path.join(
                                    path.dirname(this.imagePath),
                                    path.basename(this.imagePath, path.extname(this.imagePath)) + '.plist'
                                )),
                                filters: {
                                    'Plist Files': ['plist']
                                }
                            }).then(result => result.fsPath);

                            if (outputPath) {
                                await createPlist(this.imagePath, message.rows, message.cols, outputPath);
                                vscode.window.showInformationMessage(`Successfully created plist file at ${outputPath}`);
                                const doc = await vscode.workspace.openTextDocument(outputPath);
                                await vscode.window.showTextDocument(doc);
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`Error creating plist file: ${error.message}`);
                        }
                        break;
                    case 'error':
                        vscode.window.showErrorMessage(message.message);
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    static createOrShow(extensionUri, imagePath) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (PlistCreatorPanel.currentPanel) {
            PlistCreatorPanel.currentPanel.panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            PlistCreatorPanel.viewType,
            'Plist Creator',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        PlistCreatorPanel.currentPanel = new PlistCreatorPanel(panel, extensionUri, imagePath);
    }

    dispose() {
        PlistCreatorPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    async _updateWebview() {
        this.panel.webview.html = this._getWebviewContent();

        // Get image metadata with detailed error handling
        try {
            console.log('Reading image:', this.imagePath);
            const metadata = await getImageMetadata(this.imagePath);
            console.log('Image metadata:', metadata);

            // Read the image file and convert to base64
            const imageBuffer = fs.readFileSync(this.imagePath);
            const base64Image = imageBuffer.toString('base64');
            const imageData = `data:image/png;base64,${base64Image}`;

            this.panel.webview.postMessage({
                type: 'setImage',
                image: {
                    width: metadata.width,
                    height: metadata.height
                },
                imageData: imageData
            });
        } catch (error) {
            console.error('Error in _updateWebview:', error);
            this.panel.webview.postMessage({
                type: 'error',
                message: `Error reading image: ${error.message}`
            });
        }
    }

    _getWebviewContent() {
        const webview = this.panel.webview;
        const previewPath = vscode.Uri.joinPath(this.extensionUri, 'src', 'webview', 'preview.html');
        let html = fs.readFileSync(previewPath.fsPath, 'utf8');

        // Replace local resource references
        html = html.replace(/(?<=src|href)="([^"]*)"/g, (match, p1) => {
            return `="${webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, p1))}"`;
        });

        return html;
    }
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    let disposable = vscode.commands.registerCommand('plist-creator.createPlist', async (uri) => {
        try {
            // Get the image file path
            const imagePath = uri ? uri.fsPath : await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Images': ['png', 'jpg', 'jpeg']
                }
            }).then(result => result[0].fsPath);

            if (!imagePath) {
                return;
            }

            // Validate image before proceeding
            try {
                console.log('Validating image:', imagePath);
                await getImageMetadata(imagePath);
                console.log('Image validation successful');
            } catch (error) {
                console.error('Image validation failed:', error);
                vscode.window.showErrorMessage(`Invalid image: ${error.message}`);
                return;
            }

            // Create and show panel
            PlistCreatorPanel.createOrShow(context.extensionUri, imagePath);

        } catch (error) {
            console.error('Error in activate:', error);
            vscode.window.showErrorMessage(`Error: ${error.message}`);
        }
    });

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
}; 