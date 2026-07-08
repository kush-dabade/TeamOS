export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiError {
  code: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiError;
}