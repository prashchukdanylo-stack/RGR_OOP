import * as fs from "fs";
import { ClassModel, InterfaceModel } from "./parser";

export class DiagramGenerator {
  private classes: ClassModel[];
  private interfaces: InterfaceModel[];
  private outputPath: string;
  private diagramPath: string;

  constructor(
    classes: ClassModel[],
    outputPath: string,
    diagramPath: string,
    interfaces: InterfaceModel[] = [],
  ) {
    this.classes = classes;
    this.interfaces = interfaces;
    this.outputPath = outputPath;
    this.diagramPath = diagramPath;
  }

  private formatMermaidType = (typeStr: string): string =>
    typeStr
    .replace(/</g, "~")
    .replace(/>/g, "~")
    .replace(/\{/g, "(")
    .replace(/\}/g, ")")
    .replace(/;/g, ",");

  public generate(): void {
    let mmdContext = "classDiagram\n";

    for (const cls of this.classes) {
      mmdContext += `    class ${cls.name} {\n`;
      if (cls.isAbstract) {
        mmdContext += `        <<abstract>>\n`;
      }

      for (const field of cls.fields) {
        const formattedType = this.formatMermaidType(field.type);
        const optionalMark = field.isOptional ? "?" : "";
        const readonlySuffix = field.isReadonly ? " [readonly]": "";
        const classifierSuffix = field.isStatic ? "$" : field.isAbstract ? "*" : "";
        mmdContext += `        ${field.visibility}${field.name}${optionalMark} : ${formattedType}${readonlySuffix}${classifierSuffix}\n`;
      }

      for (const method of cls.methods) {
        const formattedParams = method.parameters
          ? this.formatMermaidType(method.parameters)
          : "";
        const formattedReturn = method.type
          ? ` ${this.formatMermaidType(method.type)}`
          : "";
        const classifierSuffix = method.isStatic ? "$" : method.isAbstract ? "*" : "";
        mmdContext += `        ${method.visibility}${method.name}(${formattedParams})${formattedReturn}${classifierSuffix}\n`;
      }

      mmdContext += `    }\n\n`;
    }

    for (const iface of this.interfaces) {
      mmdContext += `    class ${iface.name} {\n`;
      mmdContext += `        <<interface>>\n`;

      for (const field of iface.fields) {
        const formattedType = this.formatMermaidType(field.type);
        const optionalMark = field.isOptional ? "?" : "";
        const readonlySuffix = field.isReadonly ? " [readonly]" : "";
        mmdContext += `        ${field.visibility}${field.name}${optionalMark} : ${formattedType}${readonlySuffix}\n`;
      }

      for (const method of iface.methods) {
        const formattedParams = method.parameters
          ? this.formatMermaidType(method.parameters)
          : "";
        const formattedReturn = method.type
          ? ` ${this.formatMermaidType(method.type)}`
          : "";
        mmdContext += `        ${method.visibility}${method.name}(${formattedParams})${formattedReturn}\n`;
      }

      mmdContext += `    }\n\n`;
    }

    for (const cls of this.classes) {
      if (cls.extendsClass) {
        mmdContext += `    ${cls.extendsClass} <|-- ${cls.name}\n`;
      }

      if (cls.relations) {
        for (const rel of cls.relations) {
          if (rel.type === "composition") {
            mmdContext += `    ${rel.from} *-- ${rel.to}\n`;
          } else if (rel.type === "aggregation") {
            mmdContext += `    ${rel.from} o-- ${rel.to}\n`;
          } else if (rel.type === "dependency") {
            mmdContext += `    ${rel.from} ..> ${rel.to}\n`;
          } else {
            mmdContext += `    ${rel.from} --> ${rel.to}\n`;
          }
        }
      }

      if (cls.implementsInterfaces) {
        for (const iface of cls.implementsInterfaces) {
          mmdContext += `    ${cls.name} ..|> ${iface}\n`;
        }
      }
    }

    for (const iface of this.interfaces) {
      if (iface.extendsInterfaces) {
        for (const parentIface of iface.extendsInterfaces) {
          mmdContext += `    ${parentIface} <|-- ${iface.name}\n`;
        }
      }
    }

    fs.writeFileSync(this.outputPath, mmdContext, "utf-8");
    const diagram = `\`\`\`mermaid\n${mmdContext}\`\`\`\n`;
    console.log(diagram);
    fs.writeFileSync(this.diagramPath, diagram, "utf-8");
  }
}