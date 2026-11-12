/** mock = fake server in the browser with sample data; real = a deployed backend at VITE_API_BASE. */
export const IS_MOCK = import.meta.env.VITE_API_MODE !== 'real';
