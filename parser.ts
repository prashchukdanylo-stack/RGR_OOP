import * as ts from "typescript";
import * as fs from "fs";

export interface ClassMember {
  name: string;
  type: string;
  visibility: "+" | "-" | "#";
  parameters?: string;
  isStatic?: boolean;
  isReadonly?: boolean;
}

export interface ClassModel {
  name: string;
  isAbstract?: boolean;
  fields: ClassMember[];
  methods: ClassMember[];
  extendsClass?: string;
  relations?: ClassRelation[];
  implementsInterfaces?: string[];
}

export interface ClassRelation {
  from: string;
  to: string;
  type: "association" | "aggregation" | "composition" | "dependency";
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
      return { classes: [], interfaces: [] };
    }

    const fileContent = fs.readFileSync(this.filePath, "utf-8");
    const sourceFile = ts.createSourceFile(
      this.filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    );

    const knownTypes = new Set<string>();
    this.collectKnownTypes(sourceFile, knownTypes);

    const classes: ClassModel[] = [];
    const interfaces: InterfaceModel[] = [];
    this.visit(sourceFile, sourceFile, classes, knownTypes, interfaces);
    return { classes, interfaces };
  }

  private collectKnownTypes(node: ts.Node, knownTypes: Set<string>): void {
    if (
      (ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node)) &&
      node.name
    ) {
      knownTypes.add(node.name.text);
    }
    ts.forEachChild(node, (child) => this.collectKnownTypes(child, knownTypes));
  }

  private extractBaseTypeName(typeStr: string): string {
    const genericInner = typeStr.trim().match(/^[^<]+<(.+)>$/);
    const inner = genericInner ? genericInner[1] : typeStr.trim();
    return inner.replace(/\[\]|<.*>|\|/g, "").trim();
  }

  private hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
    const modifiers = ts.canHaveModifiers(node)
      ? ts.getModifiers(node)
      : undefined;
    return Boolean(modifiers?.some((mod) => mod.kind === kind));
  }

  private visit(
    node: ts.Node,
    sourceFile: ts.SourceFile,
    classes: ClassModel[],
    knownTypes: Set<string>,
    interfaces: InterfaceModel[],
  ): void {
    if (ts.isClassDeclaration(node) && node.name) {
      const className = node.name.text;
      const isAbstract = this.hasModifier(node, ts.SyntaxKind.AbstractKeyword);
      const fields: ClassMember[] = [];
      const methods: ClassMember[] = [];
      const relations: ClassRelation[] = [];
      let extendsClass: string | undefined = undefined;
      const implementsInterfaces: string[] = [];
      const composedInConstructor = new Set<string>();
      const structuralTargets = new Set<string>();
      const dependencyCandidates = new Set<string>();

      if (node.heritageClauses) {
        for (const clause of node.heritageClauses) {
          if (
            clause.token === ts.SyntaxKind.ExtendsKeyword &&
            clause.types.length > 0
          ) {
            extendsClass = clause.types[0].expression.getText(sourceFile);
            structuralTargets.add(this.extractBaseTypeName(extendsClass));
          } else if (clause.token === ts.SyntaxKind.ImplementsKeyword) {
            for (const exprWithTypeArgs of clause.types) {
              const ifaceName = exprWithTypeArgs.expression.getText(sourceFile);
              implementsInterfaces.push(ifaceName);
              structuralTargets.add(this.extractBaseTypeName(ifaceName));
            }
          }
        }
      }

      for (const member of node.members) {
        if (ts.isConstructorDeclaration(member) && member.body) {
          this.collectConstructorNewAssignments(
            member.body,
            composedInConstructor,
          );
        }
      }

      const registerFieldAndRelation = (
        propName: string,
        propType: string,
        visibility: "+" | "-" | "#",
        isStatic: boolean,
        isReadonly: boolean,
        initializer?: ts.Expression,
      ): void => {
        fields.push({
          name: propName,
          type: propType,
          visibility,
          isStatic,
          isReadonly,
        });

        const normalizedType = propType.trim();
        const genericMatch = normalizedType.match(
          /^(?:Array|ReadonlyArray|Set|ReadonlySet)<(.+)>$/,
        );
        const isCollection =
          normalizedType.includes("[]") || Boolean(genericMatch);
        const cleanType = this.extractBaseTypeName(propType);

        if (knownTypes.has(cleanType) && cleanType !== className) {
          structuralTargets.add(cleanType);

          const hasDirectNew = initializer
            ? this.containsNewExpression(initializer)
            : false;
          const isComposed =
            hasDirectNew || composedInConstructor.has(propName);

          const relationType: "association" | "aggregation" | "composition" =
            isComposed
              ? "composition"
              : isCollection
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
              type: relationType,
            });
          }
        }
      };

      node.members.forEach((member) => {
        const visibility = this.getVisibility(member as ts.HasModifiers);
        const isStatic = this.hasModifier(member, ts.SyntaxKind.StaticKeyword);
        const isReadonly = this.hasModifier(
          member,
          ts.SyntaxKind.ReadonlyKeyword,
        );

        if (ts.isPropertyDeclaration(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const propType = member.type
            ? member.type.getText(sourceFile)
            : "any";
          registerFieldAndRelation(
            propName,
            propType,
            visibility,
            isStatic,
            isReadonly,
            member.initializer,
          );
        } else if (ts.isMethodDeclaration(member) && member.name) {
          const methodName = member.name.getText(sourceFile);
          const returnType = member.type
            ? member.type.getText(sourceFile)
            : "void";
          const params = this.parseParameters(member.parameters, sourceFile);
          methods.push({
            name: methodName,
            type: returnType,
            visibility,
            parameters: params,
            isStatic,
          });

          this.collectDependencyTypesFromSignature(
            member.parameters,
            member.type,
            sourceFile,
            className,
            knownTypes,
            dependencyCandidates,
          );
        } else if (ts.isConstructorDeclaration(member)) {
          for (const param of member.parameters) {
            if (ts.isParameterPropertyDeclaration(param, param.parent)) {
              const paramName = param.name.getText(sourceFile);
              const paramType = param.type
                ? param.type.getText(sourceFile)
                : "any";
              const paramVisibility = this.getVisibility(param);
              const paramIsStatic = this.hasModifier(
                param,
                ts.SyntaxKind.StaticKeyword,
              );
              const paramIsReadonly = this.hasModifier(
                param,
                ts.SyntaxKind.ReadonlyKeyword,
              );
              registerFieldAndRelation(
                paramName,
                paramType,
                paramVisibility,
                paramIsStatic,
                paramIsReadonly,
                param.initializer,
              );
            }
          }

          const params = this.parseParameters(member.parameters, sourceFile);
          methods.push({
            name: "constructor",
            type: "",
            visibility,
            parameters: params,
          });

          this.collectDependencyTypesFromSignature(
            member.parameters,
            undefined,
            sourceFile,
            className,
            knownTypes,
            dependencyCandidates,
          );
        }
      });

      for (const target of dependencyCandidates) {
        if (!structuralTargets.has(target)) {
          const alreadyExists = relations.some(
            (rel) =>
              rel.from === className &&
              rel.to === target &&
              rel.type === "dependency",
          );
          if (!alreadyExists) {
            relations.push({
              from: className,
              to: target,
              type: "dependency",
            });
          }
        }
      }

      classes.push({
        name: className,
        isAbstract,
        fields,
        methods,
        extendsClass,
        relations,
        implementsInterfaces,
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
              extendsInterfaces.push(
                exprWithTypeArgs.expression.getText(sourceFile),
              );
            }
          }
        }
      }

      for (const member of node.members) {
        const visibility = this.getVisibility(member as ts.HasModifiers);
        const isReadonly = this.hasModifier(
          member,
          ts.SyntaxKind.ReadonlyKeyword,
        );

        if (ts.isPropertySignature(member) && member.name) {
          const propName = member.name.getText(sourceFile);
          const propType = member.type
            ? member.type.getText(sourceFile)
            : "any";
          fields.push({
            name: propName,
            type: propType,
            visibility,
            isReadonly,
          });
        } else if (ts.isMethodSignature(member) && member.name) {
          const methodName = member.name.getText(sourceFile);
          const methodType = member.type
            ? member.type.getText(sourceFile)
            : "void";
          const params = this.parseParameters(member.parameters, sourceFile);
          methods.push({
            name: methodName,
            type: methodType,
            visibility,
            parameters: params,
          });
        }
      }

      interfaces.push({
        name: ifaceName,
        fields,
        methods,
        extendsInterfaces,
      });
    }

    ts.forEachChild(node, (child) =>
      this.visit(child, sourceFile, classes, knownTypes, interfaces),
    );
  }

  private collectDependencyTypesFromSignature(
    parameters: ts.NodeArray<ts.ParameterDeclaration>,
    returnTypeNode: ts.TypeNode | undefined,
    sourceFile: ts.SourceFile,
    className: string,
    knownTypes: Set<string>,
    candidates: Set<string>,
  ): void {
    for (const param of parameters) {
      if (param.type) {
        const paramBaseType = this.extractBaseTypeName(
          param.type.getText(sourceFile),
        );
        if (knownTypes.has(paramBaseType) && paramBaseType !== className) {
          candidates.add(paramBaseType);
        }
      }
    }

    if (returnTypeNode) {
      const returnBaseType = this.extractBaseTypeName(
        returnTypeNode.getText(sourceFile),
      );
      if (knownTypes.has(returnBaseType) && returnBaseType !== className) {
        candidates.add(returnBaseType);
      }
    }
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

  private collectConstructorNewAssignments(
    node: ts.Node,
    targetProps: Set<string>,
  ): void {
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(node.left) &&
      node.left.expression.kind === ts.SyntaxKind.ThisKeyword
    ) {
      if (this.containsNewExpression(node.right)) {
        targetProps.add(node.left.name.text);
      }
    }
    ts.forEachChild(node, (child) =>
      this.collectConstructorNewAssignments(child, targetProps),
    );
  }

  private containsNewExpression(node: ts.Node): boolean {
    if (ts.isNewExpression(node)) {
      return true;
    }
    let found = false;
    ts.forEachChild(node, (child) => {
      if (this.containsNewExpression(child)) {
        found = true;
      }
    });
    return found;
  }
}