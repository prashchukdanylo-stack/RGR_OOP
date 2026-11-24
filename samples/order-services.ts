import { IPaymentGateway } from "./contracts";
import { CustomerOrder } from "./models";

export class OrderProcessor {
  private readonly gateway: IPaymentGateway;

  constructor(gateway: IPaymentGateway) {
    this.gateway = gateway;
  }

  public checkout(order: CustomerOrder, totalAmount: number, currency?: string): boolean {
    if (order.entries.length === 0) {
      return false;
    }
    return this.gateway.charge(totalAmount, currency);
  }
}