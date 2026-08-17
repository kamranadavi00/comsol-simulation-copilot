const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function backendRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: { Accept: "application/json", ...options?.headers },
    });
  } catch {
    throw new ApiError("The analysis backend is unreachable. Start FastAPI on port 8000.");
  }

  if (!response.ok) {
    let detail = `Request failed with status ${response.status}.`;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload.detail) detail = payload.detail;
    } catch {
      // Keep the status-based fallback for non-JSON failures.
    }
    throw new ApiError(detail, response.status);
  }

  return (await response.json()) as T;
}
