import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (res.ok) return;

  const raw = (await res.text()) || res.statusText;
  let message = raw;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error === "string") message = parsed.error;
    else if (typeof parsed?.message === "string") message = parsed.message;
  } catch {
    // Keep the plain-text response when the server did not return JSON.
  }

  throw new Error(message ? `${res.status}: ${message}` : `${res.status}: ${res.statusText}`);
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    cache: "no-store",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Cache-Control": "no-cache",
      },
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    // Some browsers/proxies can still answer a conditional API request with
    // 304 and no body. React Query needs a value, so preserve the last known
    // good payload instead of turning an unchanged response into a false error.
    if (res.status === 304) {
      const cached = queryClient.getQueryData<T>(queryKey);
      if (cached !== undefined) return cached;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      // Safe reads recover from brief mobile/network failures. Authentication,
      // permission, and not-found responses are real failures and are not retried.
      retry: (failureCount, error: any) => {
        const message = String(error?.message || "");
        if (/^(401|403|404):/.test(message)) return false;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(750 * 2 ** attemptIndex, 2500),
    },
    mutations: {
      retry: false,
    },
  },
});

export function handleAuthError(error: any) {
  if (error?.message?.includes("401")) {
    window.location.reload();
  }
}
