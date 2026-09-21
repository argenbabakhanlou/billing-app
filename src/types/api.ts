export type IsoDate = string;
export type Money = string;

export interface ErrorResponse {
  error: {
    message: string;
    code: string;
    requestId?: string;
  };
}
