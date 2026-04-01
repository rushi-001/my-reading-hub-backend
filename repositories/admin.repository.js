import { AdminModel } from "../models/admin.model.js";
import { BaseRepository } from "./base.repository.js";

class AdminRepository extends BaseRepository {
  constructor() {
    super(AdminModel);
  }

  findSingleAdmin() {
    return this.model.findOne().sort({ createdAt: 1 });
  }

  findByUsername(username) {
    return this.model.findOne({ username });
  }

  countAdmins() {
    return this.model.countDocuments();
  }
}

export const adminRepository = new AdminRepository();
