import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

export class ClassParser {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }
  public parse(): void {
    if (!fs.existsSync(this.filePath)) {
      console.error("Файл не знайдено: ", this.filePath);
      return;
    }
    const fileContent = fs.readFileSync(this.filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      this.filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    );
    this.visit(sourceFile, sourceFile);
  }
  private visit(node: ts.Node, sourceFile:ts.SourceFile):void {
  if (ts.isClassDeclaration(node) && node.name) {
    console.log(`знайдено клас: ${node.name.text}`);
    node.members.forEach((member) => {
        const visibility = this.getVisibility(member as ts.HasModifiers);

        if (ts.isPropertyDeclaration(member) && member.name) {
            const propName = member.name.getText(sourceFile);
            const propType = member.type ? member.type.getText(sourceFile) : "any";
            console.log(`   Поле:   ${visibility}${propName} : ${propType}`);
        }
        else if (ts.isMethodDeclaration(member) && member.name) {
            const methodName = member.name.getText(sourceFile);
            const returnType = member.type ? member.type.getText(sourceFile) : 'void';
            console.log(`   Метод:  ${visibility}${methodName} : ${returnType}`);
        }
    })
  }
  ts.forEachChild(node, (child) => this.visit(child, sourceFile));
}

 private getVisibility(node: ts.HasModifiers):'+'| "-" | "#" {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers) return '+';
    for (const mod of modifiers) {
        if (mod.kind === ts.SyntaxKind.PrivateKeyword) return '-';
        if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return '#';
    }
    return '+';
 }
}



