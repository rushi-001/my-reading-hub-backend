export class BaseRepository {
  constructor(model, idField = "id") {
    this.model = model;
    this.idField = idField;
  }

  findAll(query = {}, sort = { updatedAt: -1, createdAt: -1 }) {
    return this.model.find(query).sort(sort);
  }

  findById(id) {
    return this.model.findOne({ [this.idField]: id });
  }

  create(data) {
    return this.model.create(data);
  }

  updateById(id, update, options = { new: true, runValidators: true }) {
    return this.model.findOneAndUpdate({ [this.idField]: id }, update, options);
  }

  deleteById(id) {
    return this.model.findOneAndDelete({ [this.idField]: id });
  }
}

