interface INotifiable {
  readonly channel: string;
  note?: string;
  notify(message: string, urgent?: boolean): void;
}

class AuditService {
  public write(eventName: string, detail?: string): void {
    void eventName;
    void detail;
  }
}

class ShippingZone {
  constructor(
    public readonly region: string,
    public postalCode?: string,
  ) {}
}

class PromoCode {
  constructor(
    public readonly code: string,
    public readonly discountPercent: number,
  ) {}
}

class LineItem {
  constructor(
    public readonly sku: string,
    public readonly qty: number,
  ) {}
}

abstract class BaseRecord {
  public readonly id: number;
  public abstract readonly kind: string;
  public static readonly VERSION: string = "1.0";

  constructor(id: number) {
    this.id = id;
  }

  public abstract validate(): boolean;

  public static createId(): number {
    return Date.now();
  }
}

class PurchaseOrder extends BaseRecord implements INotifiable {
  public readonly kind: string = "ORDER";
  public readonly channel: string = "email";
  public note?: string;
  private readonly items: LineItem[];
  private promo?: PromoCode;
  private readonly zone: ShippingZone;

  constructor(
    id: number,
    zone: ShippingZone,
    rawItems: { sku: string; qty: number }[],
    promo?: PromoCode,
  ) {
    super(id);
    this.zone = zone;
    this.promo = promo;
    this.items = rawItems.map((raw) => new LineItem(raw.sku, raw.qty));
  }

  public validate(): boolean {
    return this.items.length > 0;
  }

  public notify(message: string, urgent?: boolean): void {
    void message;
    void urgent;
  }

  public archive(audit: AuditService, reason?: string): void {
    audit.write(`order:${this.id}`, reason);
  }
}

class CustomerAccount {
  public readonly orders: PurchaseOrder[] = [];

  constructor(
    public readonly email: string,
    public nickname?: string,
  ) {}

  public addOrder(order: PurchaseOrder): void {
    this.orders.push(order);
  }
}