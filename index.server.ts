import type { PluginServerContext } from "@getpaseo/plugin/server";
import { attach, create, detach, overview, remove } from "./server/worktrees";
import { attachRpc, createRpc, detachRpc, overviewRpc, removeRpc } from "./shared/contracts";

export default function contribute(server: PluginServerContext) {
  server.handle(overviewRpc, overview);
  server.handle(createRpc, create);
  server.handle(attachRpc, attach);
  server.handle(detachRpc, detach);
  server.handle(removeRpc, remove);
  return () => {};
}
