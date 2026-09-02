import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { PublicAdmissionService } from "@/modules/admissions/application/admission-service";
import {
  createPublicFormToken,
  publicAdmissionSubmissionSchema,
} from "@/modules/admissions/domain/admission-contracts";
import { requestMetadata } from "@/modules/identity/domain/request-security";
import { prisma } from "@/server/database/prisma";
import { parseRequestBody } from "@/server/http/request-body";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ publicKey: string }> },
) {
  try {
    const { publicKey } = await params;
    const form = await new PublicAdmissionService(prisma).form(publicKey);
    return NextResponse.json(
      { ...form, formToken: createPublicFormToken(publicKey) },
      {
        headers: {
          "Cache-Control": "no-store",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Admission form not found" },
      { status: 404 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicKey: string }> },
) {
  try {
    const { publicKey } = await params;
    const input = await parseRequestBody(
      request,
      publicAdmissionSubmissionSchema,
    );
    const result = await new PublicAdmissionService(prisma).submit(
      publicKey,
      input,
      requestMetadata(request.headers),
    );
    return NextResponse.json(result, {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof ZodError)
      return NextResponse.json(
        { error: "Please check the form fields", issues: error.issues },
        { status: 400 },
      );
    if (error instanceof Error && error.message.includes("rate limit"))
      return NextResponse.json(
        { error: "Please wait before trying again" },
        { status: 429 },
      );
    return NextResponse.json(
      { error: "The form could not be submitted" },
      { status: 400 },
    );
  }
}
