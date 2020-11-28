declare namespace NodeJS {
  export interface ProcessEnv {
    DATABADE_URL : string;
    REDIS_URL : string;
    PORT : string;
    SESSION_SECRET : string;
    CORS_ORIGIN : string;
    DOMAIN_URL : string;
  }
}
