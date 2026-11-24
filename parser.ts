import * as ts from "typescript";
import * as path from "path";
import * as fs from "fs";

export interface ClassMember {
  name: string;
  type: string;
  visibility: "+" | "-" | "#";
  parameters?: string;
}

export interface ClassModel {
  name: string;
  fields: ClassMember[];
  methods: ClassMember[];
  extendsClass?: string;
  relations?: ClassRelation[];
  implementsInterfaces?: string[];
}

export interface ClassRelation {
  from: string;
  to: string;
  type: "association" | "aggregation";
}
export interface InterfaceModel {
    name: string;
    fields: ClassMember[];
    methods: ClassMember[];
    extendsInterfaces?: string[];
}

export interface ParseResult {
    classes: ClassModel[];
    interfaces: InterfaceModel[];
}

export class ClassParser {
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  public parse(): ParseResult {
    if (!fs.existsSync(this.filePath)) {
      console.error("Файл не знайдено: ", this.filePath);
      return {classes: [], interfaces: []};
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
    const interfaces: InterfaceModel[] = [];
    this.visit(sourceFile, sourceFile, classes,classNames, interfaces);
    return {classes, interfaces};
  }

  private collectClassNames(node: ts.Node, classNames: Set<string>): void {
    if (ts.isClassDeclaration(node) && node.name) {
      classNames.add(node.name.text);
    }
    ts.forEachChild(node, (child) => this.collectClassNames(child, classNames));
  }

  private visit(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    classes: ClassModel[],
    classNames: Set<string>,
    interfaces: InterfaceModel[]
  ): void {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const fields: ClassMember[] = [];
      const methods: ClassMember[] = [];
      const relations: ClassRelation[] = [];
      let extendsClass: string | undefined = undefined;
      const implementsInterfaces: string[] = [];

      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (
            clause.token === ts.SyntaxKind.ExtendsKeyword &&
            clause.types.length > 0
          ) {
            extendsClass = clause.types[0].expression.getText(sourceFile);
          } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
            for (const exprWithTypeArgs of clause.types) {
                implementsInterfaces.push(exprWithTypeArgs.expression.getText(sourceFile));
            }
          }
        }
      }

      node.members.forEach((member) => {
        const visibility = this.getVisibility(member as ts.HasModifiers);

        if (ts.isPropertyDeclaration(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const propType = member.type
            ? member.type.getText(sourceFile)
            : "any";
          fields.push({
            name: propName,
            type: propType,
            visibility: visibility,
          });

          const normalizedType = propType.trim();
          const genericMatch = normalizedType.match(/^(?:Array|ReadonlyArray|Set|ReadonlySet)<(.+)>$/);
          const isCollection = normalizedType.includes("[]") || Boolean(genericMatch);
          const cleanType = genericMatch ? genericMatch[1].replace(/\[\]|<.*>/g, "").trim()
          : normalizedType.replace(/\[\]|<.*>/g, "").trim();

          if (classNames.has(cleanType) && cleanType !== className) {
            
            const relationType: "association" | "aggregation" = isCollection
              ? "aggregation"
              : "association";
            const alreadyExists = relations.some(
              (rel) =>
                rel.from === className &&
                rel.to === cleanType &&
                rel.type === relationType,
            );
            if (!alreadyExists) {
              relations.push({
                from: className,
                to: cleanType,
                type: isCollection ? "aggregation" : "association",
              });
            }
          }
        } else if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = member.name.getText(sourceFile);
          const returnType = member.type
            ? member.type.getText(sourceFile)
            : "void";
          const params = this.parseParameters(member.parameters, sourceFile);
          methods.push({
            name: methodName,
            type: returnType,
            visibility: visibility,
            parameters: params,
          });
        } else if (ts.isConstructorDeclaration(member)) {
          const params = this.parseParameters(member.parameters, sourceFile);
          methods.push({
            name: "constructor",
            type: "",
            visibility: visibility,
            parameters: params,
          });
        }
      });
      classes.push({
        name: className,
        fields: fields,
        methods: methods,
        extendsClass: extendsClass,
        relations: relations,
        implementsInterfaces: implementsInterfaces
      });
    }
    if (ts.isInterfaceDeclaration(node) && node.name) {
        const ifaceName = node.name.text;
        const fields: ClassMember[] = [];
        const methods: ClassMember[] = [];
        const extendsInterfaces: string[] = [];

        if (node.heritageClauses) {
            for (const clause of node.heritageClauses) {
                if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
                    for (const exprWithTypeArgs of clause.types) {
                        extendsInterfaces.push(exprWithTypeArgs.expression.getText(sourceFile));
                    }
                }
            }
        }
        for (const member of node.members) {
            const visibility = this.getVisibility(member as ts.HasModifiers);

            if (ts.isPropertySignature(member) && member.name) {
                const propName = member.name.getText(sourceFile);
                const propType = member.type ? member.type.getText(sourceFile) : "any";
                fields.push({
                    name: propName,
                    type: propType,
                    visibility
                });
            } else if (ts.isMethodSignature(member) && member.name) {
                const methodName = member.name.getText(sourceFile);
                const methodType = member.type ? member.type.getText(sourceFile) : "void";
                const params = this.parseParameters(member.parameters, sourceFile);
                methods.push({
                    name: methodName,
                    type: methodType,
                    visibility,
                    parameters: params
                })
            }
        }
        interfaces.push({
            name: ifaceName,
            fields,
            methods,
            extendsInterfaces
        })
    }
    ts.forEachChild(node, (child) =>
      this.visit(child, sourceFile, classes, classNames, interfaces),
    );
  }

  private getVisibility(node: ts.HasModifiers): "+" | "-" | "#" {
    const modifiers = ts.canHaveModifiers(node)
      ? ts.getModifiers(node)
      : undefined;
    if (!modifiers) return "+";
    for (const mod of modifiers) {
      if (mod.kind === ts.SyntaxKind.PrivateKeyword) return "-";
      if (mod.kind === ts.SyntaxKind.ProtectedKeyword) return "#";
    }
    return "+";
  }

  private parseParameters(
    parameters: ts.NodeArray<ts.ParameterDeclaration>,
    sourceFile: ts.SourceFile,
  ): string {
    return parameters
      .map((param) => {
        const paramName = param.name.getText(sourceFile);
        const paramType = param.type ? param.type.getText(sourceFile) : "any";
        return `${paramName}: ${paramType}`;
      })
      .join(", ");
  }
}
