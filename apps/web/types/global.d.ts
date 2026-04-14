import type { Mongoose } from "mongoose";

declare global {
  // Mongoose connection cache (used in lib/mongodb.ts)
  // eslint-disable-next-line no-unused-vars
  var mongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null };
}

export {};
