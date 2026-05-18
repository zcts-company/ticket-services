export function createHttpError(status: number, message: string): Error {
  const error = new Error(message);
  (error as any).statusCode = status;
  return error;
}