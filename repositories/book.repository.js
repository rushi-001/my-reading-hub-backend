import { BookModel } from "../models/book.model.js";
import { BaseRepository } from "./base.repository.js";

class BookRepository extends BaseRepository {
  constructor() {
    super(BookModel);
  }

  findWithPagination({
    query = {},
    sort = { updatedAt: -1, createdAt: -1 },
    page = 1,
    pageSize = 24,
  } = {}) {
    const skip = (page - 1) * pageSize;

    return this.model.find(query).sort(sort).skip(skip).limit(pageSize);
  }

  countByQuery(query = {}) {
    return this.model.countDocuments(query);
  }
}

export const bookRepository = new BookRepository();
