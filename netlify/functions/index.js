import serverless from "serverless-http";
import { Server } from "../../server.js";

const app = new Server().server;

export const handler = serverless(app);
