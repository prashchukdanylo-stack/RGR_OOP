import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

export interface ClassMember {
    name: string;
    type: string;
    visibility: '+' | '-' | '#';
    parameters?: string;
}

export interface ClassModel {
    name:string;
    fields: ClassMember[];
    methods: ClassMember[];
    extendsClass?: string;
    relations?: ClassRelation[];
}

export interface ClassRelation {
    from: string;
    to: string;
    type: 'association' | 'aggregation';
}

export class ClassParser {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }
  public parse(): ClassModel[] {
    if (!fs.existsSync(this.filePath)) {
      console.error("Файл не знайдено: ", this.filePath);
      return [];
    }
    const fileContent = fs.readFileSync(this.filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      this.filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    );
    const classNames = new Set<string>();
    this.collectClassNames(sourceFile, classNames);

    const classes: ClassModel[] = [];
    this.visit(sourceFile, sourceFile, classes, classNames);
    return classes;
  }


  private collectClassNames(node: ts.Node, classNames: Set<string>): void {
    if (ts.isClassDeclaration(node) && node.name) {
        classNames.add(node.name.text);
    }
    ts.forEachChild(node, (child) => this.collectClassNames(child, classNames));
  }


  private visit(node: ts.Node, sourceFile:ts.SourceFile, classes: ClassModel[], classNames:Set<string>):void {
  if (ts.isClassDeclaration(node) && node.name) {
    const className = node.name.text;
    const fields: ClassMember[] = [];
    const methods: ClassMember[] = [];
    const relations: ClassRelation[] = [];
    let extendsClass: string | undefined = undefined;

    if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
            if (clause.token === ts.SyntaxKind.ExtendsKeyword && clause.types.length > 0) {
                extendsClass = clause.types[0].expression.getText(sourceFile);
            }
        }
    }

    node.members.forEach((member) => {
        const visibility = this.getVisibility(member as ts.HasModifiers);

        if (ts.isPropertyDeclaration(member) && member.name) {
            const propName = member.name.getText(sourceFile);
            const propType = member.type ? member.type.getText(sourceFile) : "any";
            fields.push({
                name: propName,
                type: propType,
                visibility: visibility
            });

            const cleanType = propType.replace(/\[\]|<.*>/g, '').trim();

            if (classNames.has(cleanType) && cleanType !== className) {
                const isArray = propType.includes("[]");
                relations.push({
                    from: className,
                    to: cleanType,
                    type: isArray ? "aggregation" : "association"
                })
            }
        }
        else if (ts.isMethodDeclaration(member) && member.name) {
            const methodName = member.name.getText(sourceFile);
            const returnType = member.type ? member.type.getText(sourceFile) : 'void';
            const params = this.parseParameters(member.parameters, sourceFile);
            methods.push({
                name: methodName,
                type: returnType,
                visibility: visibility,
                parameters: params
            })
        }
        else if (ts.isConstructorDeclaration(member)) {
            const params = this.parseParameters(member.parameters, sourceFile);
            methods.push({
                name: 'constructor',
                type: '',
                visibility: visibility,
                parameters: params
            })
        }
    });
    classes.push({name:className, fields: fields, methods:methods, extendsClass: extendsClass, relations: relations});
  }
  ts.forEachChild(node, (child) => this.visit(child, sourceFile, classes, classNames));
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

 private parseParameters(parameters: ts.NodeArray<ts.ParameterDeclaration>, sourceFile: ts.SourceFile): string {
    return parameters.map(param => {
        const paramName = param.name.getText(sourceFile);
        const paramType = param.type ? param.type.getText(sourceFile) : 'any';
        return `${paramName}: ${paramType}`;
    }).join(", ");
 }
}



