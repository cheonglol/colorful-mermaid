import * as vscode from 'vscode'
import { parse, type GitGraph, type Pie } from '@mermaid-js/parser'

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

const SUPPORTED_TYPES: Array<string> = [
  'info',
  'gitGraph',
  'pie',
  'architecture',
]

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
    const firstLine = text.split('\n')[0].trim().toLowerCase()
    if (
      !SUPPORTED_TYPES.some((supportedGraph) =>
        firstLine.includes(supportedGraph)
      )
    ) {
      return
    }
    const diagramType = SUPPORTED_TYPES.find((type) => firstLine.includes(type))

    if (!diagramType) return

    const result = await parse(diagramType as any, text)
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
    const firstLine = text.split('\n')[0].trim()
    if (
      !SUPPORTED_TYPES.some((supportedGraph) =>
        firstLine.includes(supportedGraph)
      )
    ) {
      return [] // Return no edits for unsupported types
    }
    const type = SUPPORTED_TYPES.find((supportedGraph) =>
      firstLine.includes(supportedGraph)
    )

    const ast = await parse(type as 'pie', text) // Add await here
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
function formatGitGraph(ast: GitGraph) {
  let result = 'gitGraph '

  // Format title if present
  if (ast.title) {
    result += `    title ${ast.title}\n`
  }

  // Process each section/data point
  if (ast.statements && Array.isArray(ast.statements)) {
    for (const section of ast.statements) {
      if (section.$container.statements !== undefined) {
        // Format each section with proper indentation
        result += `    ${section.$container.statements.join('')}\n`
      }
    }
  }

  // Remove trailing newline and return
  return result.trimEnd()
}
function formatPie(ast: Pie) {
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

function formatAst(ast: Pie | GitGraph): string {
  // Simple validation
  if (!ast || !ast.$type) {
    return ''
  }
  switch (ast.$type) {
    case 'Pie':
      return formatPie(ast)
    case 'Direction':
    case 'GitGraph':
      return formatGitGraph(ast)
  }
}

export function deactivate() {}
