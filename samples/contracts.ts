export interface IIdentifiable {
  readonly id: string;
}

export interface IPaymentGateway {
  readonly providerName: string;
  charge(amount: number, currency?: string): boolean;
}

export abstract class BaseEntity implements IIdentifiable {
  public readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  public abstract describe(): string;
}