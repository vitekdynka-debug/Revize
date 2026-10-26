export interface Issue {
  path: (string | number)[];
  message: string;
}

/** Error with an HTTP status, a machine-readable code and a Czech user-facing message. */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly issues?: Issue[],
  ) {
    super(message);
  }
}

export const unauthorized = (message = 'Přihlaste se prosím.') =>
  new AppError(401, 'unauthorized', message);
export const forbidden = (message = 'K této akci nemáte oprávnění.') =>
  new AppError(403, 'forbidden', message);
export const notFound = (message = 'Záznam nebyl nalezen.') =>
  new AppError(404, 'not_found', message);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const versionConflict = () =>
  conflict('version_conflict', 'Záznam mezitím změnil někdo jiný. Načtěte ho znovu.');
export const validationError = (issues: Issue[], message = 'Zadané údaje nejsou platné.') =>
  new AppError(400, 'validation', message, issues);
