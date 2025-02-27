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
import type { Node, Tree } from 'web-tree-sitter'
import vscode from 'vscode'

const { Language, Parser } = require('web-tree-sitter')

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

function analyzeDiagnostics(document: TextDocument, parser: typeof Parser) {
  // Handle both .mermaid files and markdown files with mermaid code blocks
  if (document.languageId !== 'mermaid' && document.languageId !== 'markdown') {
    return
  }

  const diagnostics: Diagnostic[] = []

  if (document.languageId === 'markdown') {
    // Process markdown file for mermaid code blocks
    const text = document.getText()
    const mermaidBlocks = findMermaidCodeBlocks(text)

    mermaidBlocks.forEach((block) => {
      const tree = parser.parse(block.content)
      if (!tree) return
      processTree(tree, block.startLine, diagnostics, document)
    })
  } else {
    // Process regular mermaid file
    const text = document.getText()
    const tree = parser.parse(text)

    if (!tree) return
    processTree(tree, 0, diagnostics, document)
  }

  diagnosticCollection.set(document.uri, diagnostics)
}

interface CodeBlock {
  content: string
  startLine: number
  endLine: number
}

function findMermaidCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = []
  const lines = text.split('\n')
  let inBlock = false
  let currentBlock: CodeBlock | null = null

  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    if (trimmedLine.startsWith('```mermaid')) {
      inBlock = true
      currentBlock = {
        content: '',
        startLine: index + 1,
        endLine: -1,
      }
    } else if (trimmedLine === '```' && inBlock) {
      if (currentBlock) {
        currentBlock.endLine = index - 1
        blocks.push(currentBlock)
      }
      inBlock = false
      currentBlock = null
    } else if (inBlock && currentBlock) {
      currentBlock.content += line + '\n'
    }
  })

  return blocks
}

function processTree(
  tree: Tree,
  lineOffset: number,
  diagnostics: Diagnostic[],
  document: TextDocument
) {
  function visitNode(node: Node) {
    if (node.hasError) {
      const range = new Range(
        new Position(
          node.startPosition.row + lineOffset,
          node.startPosition.column
        ),
        new Position(node.endPosition.row + lineOffset, node.endPosition.column)
      )

      const diagnostic = new Diagnostic(
        range,
        createDiagnosticMessage(node),
        DiagnosticSeverity.Error
      )
      diagnostic.source = 'mermaid-syntax'

      diagnostics.push(diagnostic)
    }

    for (let child of node.children) {
      if (child) visitNode(child)
    }
  }

  tree.rootNode && visitNode(tree.rootNode)
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
