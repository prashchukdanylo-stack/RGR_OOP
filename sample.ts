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

    constructor(name:string, age:number, breed:string) {
        super(name, age);
        this.breed = breed;
    }

    public bark():void {
        console.log("Woof");
    }
}