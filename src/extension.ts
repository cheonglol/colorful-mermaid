import {
  ExtensionContext,
  Uri,
  DiagnosticCollection,
  languages,
  TextDocument,
  Diagnostic,
  DiagnosticSeverity,
  Position,
  Range,
  workspace,
} from 'vscode'
import { Language, Parser, Node } from 'web-tree-sitter'
import vscode from 'vscode'

let diagnosticCollection: DiagnosticCollection

export async function activate(context: ExtensionContext) {
  try {
    await Parser.init()

    // Create diagnostic collection
    diagnosticCollection =
      languages.createDiagnosticCollection('mermaid-syntax')
    context.subscriptions.push(diagnosticCollection)

    const wasmUri = Uri.joinPath(
      context.extensionUri,
      'tree-sitter-mermaid.wasm'
    ).fsPath

    const Mermaid = await Language.load(wasmUri)
    const parser = new Parser()
    parser.setLanguage(Mermaid)

    // Register event handlers for diagnostics
    context.subscriptions.push(
      workspace.onDidChangeTextDocument((event) => {
        analyzeDiagnostics(event.document, parser)
      }),
      workspace.onDidOpenTextDocument((document) => {
        analyzeDiagnostics(document, parser)
      })
    )

    // Initial analysis of active editor
    if (vscode.window.activeTextEditor) {
      analyzeDiagnostics(vscode.window.activeTextEditor.document, parser)
    }
  } catch (error) {
    console.error('Failed to initialize Tree-sitter:', error)
  }
}

function analyzeDiagnostics(document: TextDocument, parser: Parser) {
  // Only analyze Mermaid files
  if (document.languageId !== 'mermaid') {
    return
  }

  const text = document.getText()
  const tree = parser.parse(text)
  const diagnostics: Diagnostic[] = []

  // Recursively check for ERROR and MISSING nodes
  function visitNode(node: Node) {
    if (node.hasError) {
      const range = new Range(
        new Position(node.startPosition.row, node.startPosition.column),
        new Position(node.endPosition.row, node.endPosition.column)
      )

      // Create diagnostic
      const diagnostic = new Diagnostic(
        range,
        createDiagnosticMessage(node),
        DiagnosticSeverity.Error
      )
      diagnostic.source = 'mermaid-syntax'

      diagnostics.push(diagnostic)
    }

    // Visit children
    for (let child of node.children) {
      if (child) visitNode(child)
    }
  }

  tree?.rootNode && visitNode(tree?.rootNode)
  diagnosticCollection.set(document.uri, diagnostics)
}

function createDiagnosticMessage(node: Node): string {
  let message = node.hasError ? `Missing '${node.type}'` : 'Syntax error'

  // Add context from parent node
  const parent = node.parent
  if (parent && parent.type !== 'ERROR') {
    message += ` in ${parent.type}`
  }

  // Add context from previous sibling
  const previousSibling = node.previousSibling
  if (previousSibling && previousSibling.type !== 'ERROR') {
    message += ` after ${previousSibling.type}`
  }

  return message
}

export function deactivate() {
  if (diagnosticCollection) {
    diagnosticCollection.dispose()
  }
}
