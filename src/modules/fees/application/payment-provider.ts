export type PaymentProviderRequest = {
  idempotencyKey: string;
  amountMinor: number;
  currency: "INR";
};

export type PaymentProviderResult = {
  provider: string;
  providerPaymentId: string;
  reference: string;
};

export interface PaymentProviderAdapter {
  readonly provider: string;
  createPayment(
    request: PaymentProviderRequest,
  ): Promise<PaymentProviderResult>;
}

export class LocalSimulatedPaymentProvider implements PaymentProviderAdapter {
  readonly provider = "LOCAL_SIMULATED";

  async createPayment(
    request: PaymentProviderRequest,
  ): Promise<PaymentProviderResult> {
    const safeKey = request.idempotencyKey
      .replace(/[^A-Za-z0-9_-]/g, "")
      .slice(0, 48);
    return {
      provider: this.provider,
      providerPaymentId: `local_${safeKey}`,
      reference: `SIM-${request.amountMinor}-${safeKey.slice(-8)}`,
    };
  }
}
