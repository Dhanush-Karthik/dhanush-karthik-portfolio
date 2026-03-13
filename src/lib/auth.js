const STORAGE_KEY = "dk_cms_auth";

export function validatePassword(password) {
  const envPassword = import.meta.env.VITE_CMS_PASSWORD;
  if (!envPassword) return false;
  return password === envPassword;
}

export function setAuthenticated() {
  const token = btoa(`dk_auth_${Date.now()}_${Math.random().toString(36).slice(2)}`);
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function isAuthenticated() {
  return !!sessionStorage.getItem(STORAGE_KEY);
}

export function clearAuth() {
  sessionStorage.removeItem(STORAGE_KEY);
}
