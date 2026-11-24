class Animal {
    public name: string;
    protected age: number;

    constructor(name:string, age:number) {
        this.age = age;
        this.name = name;
    }

    public move():void {
        console.log(`${this.name} moves.`);
    }
}

interface Swimmable {
    swim() : void
}
interface Proswimmer extends Swimmable {
    dive() : void
}

class Dog extends Animal implements Proswimmer {
    private breed: string;
    private bestToy: Array<Bone>;
    private constructor(name:string, age:number, breed:string, bestToy: Array<Bone>) {
        super(name, age);
        this.breed = breed;
        this.bestToy = bestToy;
    }   
    private getOneAgeMore(age:number): number {
        return age + 1;
    }
    public bark():void {
        console.log("Woof");
    }
    protected eatBone() : string {
        return "am nam nam";
    }
    public swim() : void {
        console.log("bulbul");
    }
    public dive() : void {
        console.log("bum");
    }
}

class Bone {
    private name: string;
    constructor(name: string) {
        this.name = name;
    }
}