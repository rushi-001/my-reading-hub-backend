import ServerlessHttp from "serverless-http";
import { Server } from "../../server.js";

const app = new Server();

module.exports.handler = ServerlessHttp(app);