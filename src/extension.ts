import * as vscode from 'vscode'
import { parse, type Pie } from '@mermaid-js/parser'

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection =
    vscode.languages.createDiagnosticCollection('mermaid')
  context.subscriptions.push(diagnosticCollection)

  vscode.workspace.onDidOpenTextDocument((doc) =>
    lintDocument(doc, diagnosticCollection)
  )
  vscode.workspace.onDidChangeTextDocument((event) =>
    lintDocument(event.document, diagnosticCollection)
  )
  vscode.workspace.onDidSaveTextDocument((doc) =>
    lintDocument(doc, diagnosticCollection)
  )

  // Add formatter registration
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider('mermaid', {
      async provideDocumentFormattingEdits(
        document: vscode.TextDocument
      ): Promise<vscode.TextEdit[]> {
        return formatMermaidDocument(document)
      },
    })
  )
}

async function lintDocument(
  document: vscode.TextDocument,
  diagnosticCollection: vscode.DiagnosticCollection
) {
  if (document.languageId !== 'mermaid') {
    return
  }

  const text = document.getText()
  const diagnostics: vscode.Diagnostic[] = []

  try {
    // const regularMermaid = await mermaid.parse(text)

    const supportedTypes: Array<string> = [
      'info',
      'gitGraph',
      'pie',
      'architecture',
    ]

    if (
      !supportedTypes.some((supportedGraph) => text.includes(supportedGraph))
    ) {
      return
    }

    const result = await parse('pie', text)
    console.log(result)
  } catch (error) {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, document.lineCount, 0),
      (error as Error).message,
      vscode.DiagnosticSeverity.Error
    )
    diagnostics.push(diagnostic)
  }

  diagnosticCollection.set(document.uri, diagnostics)
}

async function formatMermaidDocument(
  document: vscode.TextDocument
): Promise<vscode.TextEdit[]> {
  const text = document.getText()
  const edits: vscode.TextEdit[] = []

  try {
    // Check diagram type first
    const firstLine = text.split('\n')[0].trim().toLowerCase()
    if (!firstLine.includes('pie')) {
      return [] // Return no edits for unsupported types
    }

    const ast = await parse('pie', text) // Add await here
    const formattedText = formatAst(ast)

    // Only apply formatting if we got a valid result
    if (formattedText && formattedText.trim() !== '') {
      edits.push(
        vscode.TextEdit.replace(
          new vscode.Range(0, 0, document.lineCount, 0),
          formattedText
        )
      )
    }
  } catch (error) {
    console.error('Formatting failed:', error)
    // Return no edits if formatting fails
    return []
  }

  return edits
}

function formatAst(ast: Pie): string {
  // Simple validation
  if (!ast || !ast.$type) {
    return ''
  }

  let result = 'pie '

  // Format title if present
  if (ast.title) {
    result += `    title ${ast.title}\n`
  }

  // Process each section/data point
  if (ast.sections && Array.isArray(ast.sections)) {
    for (const section of ast.sections) {
      if (section.value !== undefined && section.label) {
        // Format each section with proper indentation
        result += `    "${section.label}" : ${section.value}\n`
      }
    }
  }

  // Remove trailing newline and return
  return result.trimEnd()
}

export function deactivate() {}
