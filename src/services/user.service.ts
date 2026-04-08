import { UserRepository, CreateUserInput, UpdateUserInput } from '../repositories/user.repository.js'

export function makeUserService(repo: UserRepository, firebaseUid: string) {
  return {
    async getUser() {
      const user = await repo.findByFirebaseUid(firebaseUid)
      if (!user) throw new Error('NOT_FOUND')
      return user
    },

    async createUser(data: Omit<CreateUserInput, 'firebaseUid'>) {
      const existing = await repo.findByFirebaseUid(firebaseUid)
      if (existing) throw new Error('USER_EXISTS')
      return repo.create({ ...data, firebaseUid })
    },

    async updateUser(data: UpdateUserInput) {
      const user = await repo.findByFirebaseUid(firebaseUid)
      if (!user) throw new Error('NOT_FOUND')
      return repo.update(user.id, data)
    },
  }
}
