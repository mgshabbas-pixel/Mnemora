/**
 * Safe API client for Focus OS.
 * Guarantees resilient parsing and avoids raw JSON parsing errors
 * when encountering network failures, CDN drops, or hosting provider HTML pages.
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeApiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const headers = new Headers(options.headers || {});
    
    // Auto-attach content-type if body is JSON string
    if (options.body && typeof options.body === 'string' && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const contentType = res.headers.get('content-type') || '';
    let parsedData: any = null;

    if (contentType.includes('application/json')) {
      try {
        parsedData = await res.json();
      } catch (jsonErr) {
        console.warn(`[API] Failed to parse JSON response from ${url}:`, jsonErr);
      }
    }

    if (res.ok) {
      return {
        ok: true,
        status: res.status,
        data: parsedData as T,
      };
    }

    // Extract error from JSON response if present
    if (parsedData && typeof parsedData === 'object') {
      const errorMsg = parsedData.error || parsedData.message;
      if (errorMsg) {
        return {
          ok: false,
          status: res.status,
          error: String(errorMsg),
          data: parsedData,
        };
      }
    }

    // If server returned non-JSON text / HTML (e.g., Vercel / Cloudflare 404 or 500 error page)
    if (res.status === 404) {
      return {
        ok: false,
        status: 404,
        error: `API route not found (404) for ${url}. Please verify serverless API deployment.`,
      };
    }

    if (res.status === 401) {
      return {
        ok: false,
        status: 401,
        error: 'Invalid email or password.',
      };
    }

    if (res.status === 403) {
      return {
        ok: false,
        status: 403,
        error: 'Access denied. Administrator privileges required.',
      };
    }

    if (res.status >= 500) {
      return {
        ok: false,
        status: res.status,
        error: `Server encountered an issue (${res.status}). Please try again shortly.`,
      };
    }

    return {
      ok: false,
      status: res.status,
      error: `Request failed with status code ${res.status}.`,
    };
  } catch (netErr: any) {
    console.error(`[API Network Error] ${url}:`, netErr);
    return {
      ok: false,
      status: 0,
      error: netErr?.message || 'Network connection error. Please check your internet connection.',
    };
  }
}
