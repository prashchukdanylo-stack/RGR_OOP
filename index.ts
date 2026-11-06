import * as path from "path";
import { ClassParser } from "./parser";

class Application {
    public run():void {
        console.log("Програма запустилася");
        const targetFile = path.join(__dirname, "../sample.ts");
        const parser = new ClassParser(targetFile);
        parser.parse();
    }
}

const app = new Application();
app.run();