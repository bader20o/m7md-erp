export class ApiError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.name = 'ApiError';
        this.code = code;
        this.details = details;
    }
}

export async function apiFetch(path, options = {}) {
    const baseUrl = '/api';
    const url = `${baseUrl}${path}`;

    const headers = {
        'Accept': 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
    };

    const fetchOptions = {
        ...options,
        credentials: 'include', // VERY IMPORTANT
        headers,
    };

    if (fetchOptions.body && typeof fetchOptions.body !== 'string') {
        fetchOptions.body = JSON.stringify(fetchOptions.body);
    }

    try {
        const response = await fetch(url, fetchOptions);

        // For specific empty or non-JSON responses
        if (response.status === 204) return null;

        let json;
        try {
            json = await response.json();
        } catch (e) {
            if (!response.ok) {
                throw new ApiError('NETWORK_ERROR', `HTTP Error ${response.status}`);
            }
            return null;
        }

        if (!json.success) {
            const { code, message, details } = json.error || {};
            throw new ApiError(code || 'UNKNOWN_ERROR', message || 'An unknown error occurred', details);
        }

        return json.data;
    } catch (error) {
        if (error instanceof ApiError) throw error;
        // Network errors (CORS, offline, etc.)
        throw new ApiError('NETWORK_ERROR', 'Network error. Please check your connection.', error.message);
    }
}

/**
 * Builds a query string from an object, removing undefined/null values.
 */
export function buildQuery(params) {
    if (!params) return '';
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && value !== '') {
            searchParams.append(key, value);
        }
    }
    const stringified = searchParams.toString();
    return stringified ? `?${stringified}` : '';
}
