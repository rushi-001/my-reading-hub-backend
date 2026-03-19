import dotenv from "dotenv";

dotenv.config();

const { Server } = await import("./server.js");

const app = new Server();
app.start();
