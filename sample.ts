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

class Dog extends Animal {
    private breed: string;
    private bestToy: Bone;
    private constructor(name:string, age:number, breed:string, bestToy: Bone) {
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
}

class Bone {
    private name: string;
    constructor(name: string) {
        this.name = name;
    }
}