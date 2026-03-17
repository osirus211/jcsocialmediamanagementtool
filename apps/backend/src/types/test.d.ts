// Global type declarations for tests
declare module 'supertest' {
  interface Test {
    set(field: string, val: string): this;
    status: number;
  }
  
  interface Response {
    status: number;
    body: any;
  }
}
