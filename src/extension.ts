import * as vscode from 'vscode';
import mermaid from 'mermaid'

export function activate(context: vscode.ExtensionContext) {
  const diagnosticCollection = vscode.languages.createDiagnosticCollection('mermaid');
  context.subscriptions.push(diagnosticCollection);

  vscode.workspace.onDidOpenTextDocument(doc => lintDocument(doc, diagnosticCollection));
  vscode.workspace.onDidChangeTextDocument(event => lintDocument(event.document, diagnosticCollection));
  vscode.workspace.onDidSaveTextDocument(doc => lintDocument(doc, diagnosticCollection));
}

async function lintDocument(document: vscode.TextDocument, diagnosticCollection: vscode.DiagnosticCollection) {
  if (document.languageId !== 'mermaid') {
    return;
  }

  const text = document.getText();
  const diagnostics: vscode.Diagnostic[] = [];

  try {
    await mermaid.parse(text);
  } catch (error) {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(0, 0, document.lineCount, 0),
      (error as Error).message,
      vscode.DiagnosticSeverity.Error
    );
    diagnostics.push(diagnostic);
  }

  diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate() { }