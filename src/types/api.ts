export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    requestId?: string;
  };
}
