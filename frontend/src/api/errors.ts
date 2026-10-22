export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export const messages: Record<number, string> = {
  400: "The request was rejected.",
  401: "Authentication is required.",
  402: "Access locked: payment or a confirmed barter is required. No data was delivered.",
  403: "Authorization was denied.",
  404: "The requested resource was not found.",
  409: "State conflict. Refresh the current workflow and retry.",
  422: "Request validation failed.",
  500: "The backend could not complete the request.",
  502: "The backend is unavailable.",
  503: "The backend is unavailable.",
};
