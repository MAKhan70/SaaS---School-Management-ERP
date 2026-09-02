const corsHeaders = {
  "content-type": "application/json",
};

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response(null, { status: 405 });
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("SUPABASE_INVITE_FROM_EMAIL");
  if (!resendKey || !from) {
    return Response.json(
      { error: "Delivery provider is not configured" },
      { status: 503 },
    );
  }
  try {
    const input = (await request.json()) as Record<string, unknown>;
    if (
      typeof input.email !== "string" ||
      !input.email.includes("@") ||
      input.email.length > 254 ||
      typeof input.firstName !== "string" ||
      input.firstName.length > 60 ||
      typeof input.trustName !== "string" ||
      input.trustName.length > 120 ||
      typeof input.activationUrl !== "string" ||
      !input.activationUrl.startsWith("https://")
    )
      return Response.json(
        { error: "Invalid request" },
        { status: 400, headers: corsHeaders },
      );

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${resendKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.email],
        subject: `Your ${input.trustName} administrator workspace is ready`,
        text: `Hello ${input.firstName},\n\nYour school administrator account is ready. Activate it using this single-use link within seven days:\n${input.activationUrl}\n\nIf you were not expecting this invitation, ignore this message.`,
      }),
    });
    return response.ok
      ? Response.json({ accepted: true }, { headers: corsHeaders })
      : Response.json(
          { error: "Delivery failed" },
          { status: 502, headers: corsHeaders },
        );
  } catch {
    return Response.json(
      { error: "Invalid request" },
      { status: 400, headers: corsHeaders },
    );
  }
});
