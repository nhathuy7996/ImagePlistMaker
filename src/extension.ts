import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import sizeOf from 'image-size';

class PlistCreatorPanel {
    public static viewType = 'plistCreator';
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private imagePath: string;

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, imagePath: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this.imagePath = imagePath;

        this._panel.webview.html = this._getWebviewContent(this._panel.webview);
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'createPlist':
                        this._createPlist(message.rows, message.cols);
                        return;
                }
            },
            null,
            this._disposables
        );
        this._updateWebview();
    }

    public static createOrShow(extensionUri: vscode.Uri, imagePath: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (PlistCreatorPanel.currentPanel) {
            PlistCreatorPanel.currentPanel._panel.reveal(column);
            return;
        }

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

    private static currentPanel: PlistCreatorPanel | undefined;

    private _getWebviewContent(webview: vscode.Webview) {
        const htmlPath = path.join(this._extensionUri.fsPath, 'src', 'webview', 'preview.html');
        let html = fs.readFileSync(htmlPath, 'utf8');
        
        // Get the local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'src', 'webview', 'preview.html');
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        
        // Replace local resource references
        html = html.replace(/(?:src|href)="([^"]+)"/g, (match, p1) => {
            return match.replace(p1, webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, p1)).toString());
        });
        
        return html;
    }

    private async _updateWebview() {
        try {
            const imageBuffer = await fs.promises.readFile(this.imagePath);
            const dimensions = sizeOf(Buffer.from(imageBuffer));
            const imageData = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            
            this._panel.webview.postMessage({
                type: 'setImage',
                image: {
                    width: dimensions.width,
                    height: dimensions.height,
                    format: dimensions.type
                },
                imageData: imageData
            });
        } catch (error: any) {
            this._panel.webview.postMessage({
                type: 'error',
                message: `Error reading image: ${error?.message || 'Unknown error'}`
            });
        }
    }

    private async _createPlist(rows: number, cols: number) {
        try {
            const imageBuffer = await fs.promises.readFile(this.imagePath);
            const dimensions = sizeOf(Buffer.from(imageBuffer));
            if (!dimensions.width || !dimensions.height) {
                throw new Error('Could not get image dimensions');
            }

            const frameWidth = Math.floor(dimensions.width / cols);
            const frameHeight = Math.floor(dimensions.height / rows);

            // Create plist XML content
            let plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple Computer//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
    <dict>
        <key>frames</key>
        <dict>`;

            // Add frames
            for (let row = 0; row < rows; row++) {
                for (let col = 0; col < cols; col++) {
                    const frameName = `frame_${row}_${col}.png`;
                    plistContent += `
            <key>${frameName}</key>
            <dict>
                <key>frame</key>
                <string>{{${col * frameWidth},${row * frameHeight},{${frameWidth},${frameHeight}}}}</string>
                <key>offset</key>
                <string>{0,0}</string>
                <key>rotated</key>
                <false/>
                <key>sourceColorRect</key>
                <string>{{0,0},{${frameWidth},${frameHeight}}}</string>
                <key>sourceSize</key>
                <string>{${frameWidth},${frameHeight}}</string>
            </dict>`;
                }
            }

            // Add metadata
            plistContent += `
        </dict>
        <key>metadata</key>
        <dict>
            <key>format</key>
            <integer>2</integer>
            <key>realTextureFileName</key>
            <string>${path.basename(this.imagePath)}</string>
            <key>size</key>
            <string>{${dimensions.width},${dimensions.height}}</string>
            <key>smartupdate</key>
            <string>$TexturePacker:SmartUpdate:${Date.now()}$</string>
            <key>textureFileName</key>
            <string>${path.basename(this.imagePath)}</string>
        </dict>
    </dict>
</plist>`;

            const saveUri = await vscode.window.showSaveDialog({
                filters: { 'Property List': ['plist'] },
                defaultUri: vscode.Uri.file(path.join(path.dirname(this.imagePath), path.basename(this.imagePath)+'.plist'))
            });

            if (saveUri) {
                await fs.promises.writeFile(saveUri.fsPath, plistContent);
                const doc = await vscode.workspace.openTextDocument(saveUri);
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage('Plist file created successfully!');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error creating plist: ${error?.message || 'Unknown error'}`);
        }
    }

    public dispose() {
        PlistCreatorPanel.currentPanel = undefined;

        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        vscode.commands.registerCommand('plist-creator.createPlist', (uri: vscode.Uri) => {
            PlistCreatorPanel.createOrShow(context.extensionUri, uri.fsPath);
        })
    );
}

export function deactivate() {} 