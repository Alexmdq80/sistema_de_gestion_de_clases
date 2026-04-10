const API_BASE_URL = '/api'; // Use relative path for Vite proxy

export const makeRequest = async (endpoint, method = 'GET', data = null, authenticate = false) => {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (authenticate) {
        const token = localStorage.getItem('token');
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            // If authentication is required but no token is found, throw an error or redirect to login
            throw new Error('No authentication token found. Please log in.');
        }
    }

    const config = {
        method,
        headers,
    };

    if (data) {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // If the token is invalid or expired, and it's not the login/register endpoint,
    // we should probably redirect to the login page.
    if (response.status === 401 || response.status === 403) {
        if (!endpoint.startsWith('/auth')) { // Avoid redirect loops on auth endpoints
            localStorage.removeItem('token');
            window.location.href = '/login'; // Redirect to login page
            return;
        }
    }

    let responseData;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
    } else {
        responseData = { message: await response.text() };
    }

    if (!response.ok) {
        // El backend devuelve errores en el campo 'error'
        const errorMsg = responseData.error || responseData.message || 'Something went wrong';
        const error = new Error(errorMsg);
        error.details = responseData.details || null;
        error.status = response.status;
        throw error;
    }

    return responseData;
};

// Specific API functions for convenience
export const authApi = {
    register: (email, password) => makeRequest('/auth/register', 'POST', { email, password }),
    login: (email, password) => makeRequest('/auth/login', 'POST', { email, password }),
};

export const practicanteApi = {
    getAll: (search = '', page = 1, limit = 50, activo = undefined) => {
        let queryString = `/practicantes?search=${search}&page=${page}&limit=${limit}`;
        if (activo !== undefined) {
            queryString += `&activo=${activo}`;
        }
        return makeRequest(queryString, 'GET', null, true);
    },
    getById: (id) => makeRequest(`/practicantes/${id}`, 'GET', null, true),
    create: (data) => makeRequest('/practicantes', 'POST', data, true),
    update: (id, data) => makeRequest(`/practicantes/${id}`, 'PUT', data, true),
    delete: (id) => makeRequest(`/practicantes/${id}`, 'DELETE', null, true),
};

// Generic API client for all resources
export const apiClient = {
get: (endpoint, params = {}) => {
    // Limpiar parámetros indefinidos o nulos
    const cleanParams = Object.keys(params).reduce((acc, key) => {
        if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
            acc[key] = params[key];
        }
        return acc;
    }, {});

    const queryParams = new URLSearchParams(cleanParams).toString();
    const url = queryParams ? `${endpoint}?${queryParams}` : endpoint;
    return makeRequest(url, 'GET', null, true);
},    post: (endpoint, data) => makeRequest(endpoint, 'POST', data, true),
    put: (endpoint, data) => makeRequest(endpoint, 'PUT', data, true),
    delete: (endpoint) => makeRequest(endpoint, 'DELETE', null, true)
};