export const getToken   = () => localStorage.getItem('zen_token');
export const saveToken  = t  => localStorage.setItem('zen_token', t);
export const clearToken = () => localStorage.removeItem('zen_token');

export const authFetch = (url, opts = {}) => {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers });
};
