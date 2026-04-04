import { UserRepository, CreateUserInput, UpdateUserInput } from '../repositories/user.repository.js'

export function makeUserService(repo: UserRepository) {
  return {
    async getUser() {
      const user = await repo.findFirst()
      if (!user) throw new Error('NOT_FOUND')
      return user
    },

    async createUser(data: CreateUserInput) {
      const existing = await repo.findFirst()
      if (existing) throw new Error('USER_EXISTS')
      return repo.create(data)
    },

    async updateUser(data: UpdateUserInput) {
      const user = await repo.findFirst()
      if (!user) throw new Error('NOT_FOUND')
      return repo.update(user.id, data)
    },
  }
}
