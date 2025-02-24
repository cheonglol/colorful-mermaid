import { ExtensionContext, Uri } from 'vscode'
import { Language, Parser } from 'web-tree-sitter'
import vscode from 'vscode'

export async function activate(context: ExtensionContext) {
  try {
    // Initialize with the correct path to the WASM file
    await Parser.init()
  } catch (error) {
    console.error('Failed to initialize Tree-sitter:', error)
  }

  const wasmUri = Uri.joinPath(
    context.extensionUri,
    'tree-sitter-mermaid.wasm'
  ).fsPath

  const Mermaid = await Language.load(wasmUri)
  const parser = new Parser()

  parser.setLanguage(Mermaid)

  const text = vscode.window.activeTextEditor?.document.getText()

  if (!text) return

  const tree = parser.parse(text)
  
}

export function deactivate() {}
