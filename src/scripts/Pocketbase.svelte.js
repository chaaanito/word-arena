import PocketBase, { LocalAuthStore } from 'pocketbase'

export const domain = 'https://word-arena.studylive.online'
export const pb = new PocketBase(domain, new LocalAuthStore('Word-Arena'))

export const current = $state({
   user: pb.authStore.record,
})
