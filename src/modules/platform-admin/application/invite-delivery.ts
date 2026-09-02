export interface ClientInviteDelivery {
  send(input: {
    email: string;
    firstName: string;
    trustName: string;
    activationUrl: string;
  }): Promise<"SENT" | "NOT_CONFIGURED" | "FAILED">;
}

export class SupabaseFunctionInviteDelivery implements ClientInviteDelivery {
  async send(input: {
    email: string;
    firstName: string;
    trustName: string;
    activationUrl: string;
  }): Promise<"SENT" | "NOT_CONFIGURED" | "FAILED"> {
    const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!projectUrl || !serviceKey) return "NOT_CONFIGURED";

    const response = await fetch(
      `${projectUrl}/functions/v1/send-client-invite`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          authorization: `Bearer ${serviceKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!response.ok) throw new Error("Invitation delivery failed");
    return "SENT";
  }
}
