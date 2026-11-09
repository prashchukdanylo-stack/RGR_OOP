import * as fs from "fs";
import {ClassModel} from './parser';

export class DiagramGenerator {
    private classes: ClassModel[];
    private outputPath: string;

    constructor(classes: ClassModel[], outputPath: string) {
        this.classes = classes;
        this.outputPath = outputPath;
    }

    public generate() : void {
        let mmdContext = 'classDiagram\n';

        for (const cls of this.classes) {
            mmdContext += ` class ${cls.name} {\n`;

            for (const field of cls.fields) {
                mmdContext += ` ${field.visibility}${field.name} : ${field.type}\n`;
            }
            for (const method of cls.methods) {
                mmdContext += ` ${method.visibility}${method.name} : ${method.type}\n`;
            }

            mmdContext += ` }\n\n`;

            if (cls.extendsClass) {
                mmdContext += ` ${cls.extendsClass} <|-- ${cls.name}\n`;
            }
        }

        fs.writeFileSync(this.outputPath, mmdContext, 'utf-8');
    }
}