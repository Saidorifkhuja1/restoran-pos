"use client";

import axios, { AxiosError } from "axios";
import { useAuthStore } from "@/client/store/authStore";

export const apiClient = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  config.headers.set("X-RestoPOS-CSRF", "same-origin");
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ error?: string }>) => {
    if (error.response?.status === 401 && error.config?.url?.includes("/auth/me")) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
  error?: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export async function getData<T>(url: string): Promise<T> {
  const response = await apiClient.get<ApiEnvelope<T>>(url);
  return response.data.data;
}
