import type { Mongoose } from "mongoose";

declare global {
  // Mongoose connection cache (used in lib/mongodb.ts)
  var mongoose: { conn: Mongoose | null; promise: Promise<Mongoose> | null };
}

export {};
