// 1. Узагальнення (батьківський клас)
abstract class BaseEntity {
  public id: number;
  public createdAt: Date;

  constructor(id: number) {
    this.id = id;
    this.createdAt = new Date();
  }
}

// 2. Реалізація (інтерфейс)
interface IPayable {
  pay(amount: number): boolean;
}

// Класи-компоненти для зв'язків
class OrderItem {
  constructor(
    public productName: string,
    public quantity: number,
    public price: number
  ) {}
}

class DiscountCoupon {
  constructor(
    public code: string,
    public percent: number
  ) {}
}

class DeliveryAddress {
  constructor(
    public city: string,
    public street: string
  ) {}
}

class Logger {
  public log(message: string): void {
    console.log(`[LOG]: ${message}`);
  }
}

// 5. Асоціація (двостороння: Customer знає про свої Order)
class Customer {
  public orders: Order[] = [];

  constructor(public name: string) {}

  public addOrder(order: Order): void {
    this.orders.push(order);
  }
}

// Центральний клас Order, що поєднує всі зв'язки
class Order extends BaseEntity implements IPayable {
  public status: string = 'NEW';

  // 3. Композиція: OrderItem створюються всередині Order і не живуть без нього
  private items: OrderItem[] = [];

  // 4. Агрегація: купон передається ззовні й може існувати окремо (0..1)
  private coupon?: DiscountCoupon;

  // 5. Асоціація: посилання на клієнта та адресу доставки
  public customer: Customer;
  public deliveryAddress: DeliveryAddress;

  constructor(
    id: number,
    customer: Customer,
    deliveryAddress: DeliveryAddress,
    rawItems: { name: string; qty: number; price: number }[],
    coupon?: DiscountCoupon // Агрегація через параметр конструктора
  ) {
    super(id); // Виклик конструктора BaseEntity (Наслідування)
    this.customer = customer;
    this.deliveryAddress = deliveryAddress;
    this.coupon = coupon;

    // Створення частин всередині цілого (Композиція)
    this.items = rawItems.map(
      (item) => new OrderItem(item.name, item.qty, item.price)
    );

    this.customer.addOrder(this);
  }

  public calculateTotal(): number {
    const subtotal = this.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (this.coupon) {
      return subtotal * (1 - this.coupon.percent / 100);
    }
    return subtotal;
  }

  // Реалізація методу інтерфейсу IPayable
  public pay(amount: number): boolean {
    if (amount >= this.calculateTotal()) {
      this.status = 'PAID';
      return true;
    }
    return false;
  }

  // 6. Залежність: Logger не є полем класу, а лише передається в метод
  public save(logger: Logger): void {
    logger.log(`Замовлення #${this.id} збережено зі статусом ${this.status}`);
  }
}
