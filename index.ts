import * as path from "path";
import { ClassParser } from "./parser";
import { PassThrough } from "stream";
import { DiagramGenerator} from "./generator";
class Application {
    public run():void {
        console.log("Програма запустилася");
        const targetFile = path.join(__dirname, "../sample.ts");
        const outputFile = path.join(__dirname, "../output.mmd");

        const parser = new ClassParser(targetFile);
        const parsedClasses = parser.parse();

        if (parsedClasses.length === 0) {
            console.log("Не знайдено жодного файлу");
            return;
        }

        const generator = new DiagramGenerator(parsedClasses, outputFile);
        generator.generate();
    }
}

const app = new Application();
app.run();