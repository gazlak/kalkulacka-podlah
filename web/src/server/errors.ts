/** Chyba s HTTP stavem; zpráva jde uživateli (česky). */
export class HttpError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export const unauthorized = () => new HttpError(401, "Nepřihlášen");
export const forbidden = (m = "Nedostatečná oprávnění") => new HttpError(403, m);
export const notFound = (m = "Nenalezeno") => new HttpError(404, m);
export const badRequest = (m: string) => new HttpError(400, m);
