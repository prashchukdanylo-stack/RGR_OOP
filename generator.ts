import * as fs from "fs";
import {ClassModel} from './parser';

export class DiagramGenerator {
    private classes: ClassModel[];
    private outputPath: string;
    private diagramPath:string;

    constructor(classes: ClassModel[], outputPath: string, diagramPath: string) {
        this.classes = classes;
        this.outputPath = outputPath;
        this.diagramPath = diagramPath;
    }

    public generate() : void {
        let mmdContext = 'classDiagram\n';

        for (const cls of this.classes) {
            mmdContext += ` class ${cls.name} {\n`;

            for (const field of cls.fields) {
                mmdContext += ` ${field.visibility}${field.name} : ${field.type}\n`;
            }
            for (const method of cls.methods) {
                mmdContext += ` ${method.visibility}${method.name}(${method.parameters})${method.type}\n`;
            }
            mmdContext += ` }\n\n`;
        }
            for (const cls of this.classes) {
                if (cls.extendsClass) {
                mmdContext += ` ${cls.extendsClass} <|-- ${cls.name}\n`;
            };
            if (cls.relations) {
                for (const rel of cls.relations) {
                    if (rel.type === 'aggregation') {
                        mmdContext += ` ${rel.to} o-- ${rel.from}\n`;
                    } else {
                        mmdContext += ` ${rel.to} --> ${rel.from}\n`;
                    }
            }
            }
            }


        fs.writeFileSync(this.outputPath, mmdContext, 'utf-8');
        const diagram = `\`\`\`mermaid\n${mmdContext}\`\`\`\n`;
        console.log(diagram);
        fs.writeFileSync(this.diagramPath, diagram, 'utf-8');
    }
}