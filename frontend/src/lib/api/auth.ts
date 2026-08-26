import { api } from "./client";
import type { LoginResponse } from "./types";


export interface LoginRequest {
  email: string;
  password: string;
}

export const authApi = {
  login: (data: LoginRequest) => api.post<LoginResponse>("/auth/login", data),
};
