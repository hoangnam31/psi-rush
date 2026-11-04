declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    PSI_RUSH_SITE_ENABLED?: string;
  }
}
