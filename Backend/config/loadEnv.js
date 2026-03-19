import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "..", ".env");

let loaded = false;

export const loadEnv = () => {
  if (!loaded) {
    dotenv.config({ path: envPath });
    loaded = true;
  }

  return process.env;
};

loadEnv();

export { envPath };
