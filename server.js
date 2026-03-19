import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { BookRoutes } from "./routes/book.routes.js";
import { NoteRoutes } from "./routes/note.routes.js";
import { SettingsRoutes } from "./routes/settings.routes.js";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware.js";
import { ensureUploadsDirectory, UPLOADS_ROOT } from "./utils/fileStorage.js";

dotenv.config();

const JSON_BODY_LIMIT = process.env.JSON_BODY_LIMIT || "25mb";
const URL_ENCODED_BODY_LIMIT = process.env.URL_ENCODED_BODY_LIMIT || "25mb";

export class Server {
  constructor() {
    this.server = express();
    this.PORT = process.env.PORT || 8484;
    this.middlewares()
    this.start()
    this.routes()
  }

  // Middlewares
  middlewares() {
    ensureUploadsDirectory();
    this.server.use(cors({ origin: process.env.CLIENT_URL || "*" }));
    this.server.use(express.json({ limit: JSON_BODY_LIMIT }));
    this.server.use(
      express.urlencoded({
        extended: true,
        limit: URL_ENCODED_BODY_LIMIT,
      })
    );
    this.server.use("/uploads", express.static(UPLOADS_ROOT));
  }

  // Routes
  routes() {
    this.server.get("/", (_, res) => res.send("API is running..."));

    this.server.use("/api/books", new BookRoutes().router);
    this.server.use("/api/notes", new NoteRoutes().router);
    this.server.use("/api/settings", new SettingsRoutes().router);

    this.server.use(notFoundHandler);
    this.server.use(errorHandler);
  }

  async start() {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI

    console.log(
      "--------------------------------------------------------------------------"
    );
    mongoose
      .connect(mongoUri)
      .then(() => {
        console.log("Connected to MongoDB");

        // Start the server 
        this.server.listen(this.PORT, () => {
          console.log(`Server is running`);
        });
      })
      .catch((err) => {
        console.error("Failed to connect to MongoDB", err);
      });
  }
}
