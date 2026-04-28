export const config = { runtime: "edge" };

const DESTINATION = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const BLOCKED_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

export default async function gateway(request) {
  if (!DESTINATION) {
    return new Response("meybe an error?", {
      status: 500,
    });
  }

  try {
    const slashIndex = request.url.indexOf("/", 8);
    const endpoint =
      slashIndex < 0
        ? `${DESTINATION}/`
        : DESTINATION + request.url.substring(slashIndex);

    const forwardedHeaders = new Headers();
    let remoteAddress = null;

    for (const [headerName, headerValue] of request.headers.entries()) {
      if (BLOCKED_HEADERS.has(headerName)) continue;
      if (headerName.startsWith("x-vercel-")) continue;

      if (headerName === "x-real-ip") {
        remoteAddress = headerValue;
        continue;
      }

      if (headerName === "x-forwarded-for") {
        remoteAddress ||= headerValue;
        continue;
      }

      forwardedHeaders.set(headerName, headerValue);
    }

    if (remoteAddress) {
      forwardedHeaders.set("x-forwarded-for", remoteAddress);
    }

    const requestMethod = request.method;
    const shouldAttachBody =
      requestMethod !== "GET" && requestMethod !== "HEAD";

    const proxyResponse = await fetch(endpoint, {
      method: requestMethod,
      headers: forwardedHeaders,
      body: shouldAttachBody ? request.body : undefined,
      duplex: "half",
      redirect: "manual",
    });

    return proxyResponse;
  } catch (error) {
    console.error("vorody error:", error);

    return new Response("steeam faile shod", {
      status: 502,
    });
  }
}
