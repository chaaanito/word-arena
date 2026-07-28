import PocketBase from "pocketbase";

export const domain = "https://word-arena.studylive.online";
export const pb = new PocketBase(domain);

export const current = $state({
  user: pb.authStore.record,
});
