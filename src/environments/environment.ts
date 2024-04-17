declare global {
  interface Window {
    env: { [key: string]: string | undefined } | undefined
  }
}

export const environment = {
  production: true,
  e2eeBackend: window.env?.['E2EE_BACKEND'] ?? 'http://localhost:4040',
};
