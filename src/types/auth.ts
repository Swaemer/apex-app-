export interface AuthFormData {
  email: string;
  password: string;
  confirmPassword?: string;
}

export type AuthMode = 'signup' | 'login';

export interface AuthError {
  code: string;
  message: string;
}
