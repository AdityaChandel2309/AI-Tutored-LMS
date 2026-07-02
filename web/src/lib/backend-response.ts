import { NextResponse } from "next/server";

type BackendSuccessEnvelope<T> = {
  data: T;
  meta?: {
    path?: string | null;
    timestamp?: string;
  };
};

export async function readBackendData<T>(
  response: Response,
) {
  const payload =
    (await response.json()) as BackendSuccessEnvelope<T>;
  return payload.data;
}

export async function relayBackendDataResponse(
  response: Response,
) {
  const contentType =
    response.headers.get("content-type") ??
    "application/json";

  if (!response.ok) {
    const errorPayload = await response.text();

    return new NextResponse(errorPayload, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
      },
    });
  }

  const data = await readBackendData<unknown>(
    response,
  );

  return NextResponse.json(data, {
    status: response.status,
  });
}

export async function relayBackendResponse(
  response: Response,
) {
  if (!response.ok) {
    const errorPayload = await response.text();
    return new NextResponse(errorPayload, {
      status: response.status,
      headers: response.headers,
    });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: response.headers,
  });
}
