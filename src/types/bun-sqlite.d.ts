declare module "bun:sqlite" {
  export class Database {
    constructor(path: string);
    exec(sql: string): unknown;
    prepare(sql: string): {
      run(...params: unknown[]): unknown;
      get(...params: unknown[]): unknown;
      all(...params: unknown[]): unknown[];
    };
    close(): void;
  }
}
