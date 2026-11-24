import { BaseEntity } from "./contracts";

export class LineEntry extends BaseEntity {
  constructor(
    id: string,
    public readonly sku: string,
    public readonly quantity: number,
    public note?: string,
  ) {
    super(id);
  }

  public describe(): string {
    return `${this.sku} x${this.quantity}`;
  }
}

export class CustomerOrder extends BaseEntity {
  public readonly entries: LineEntry[] = [];
  public shippingAddress?: string;

  constructor(id: string, shippingAddress?: string) {
    super(id);
    this.shippingAddress = shippingAddress;
  }

  public addItem(sku: string, quantity: number, note?: string): void {
    const entryId = `${this.id}-${this.entries.length + 1}`;
    this.entries.push(new LineEntry(entryId, sku, quantity, note));
  }

  public describe(): string {
    return `Order ${this.id} (${this.entries.length})`;
  }
}