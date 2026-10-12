import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { SCREEN_ID, WorktreesScreen } from "./client/worktrees-screen";
import { createRpc } from "./shared/contracts";

function WorktreesItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="GitBranchPlus"
      active={currentScreen?.screenId === SCREEN_ID}
      onPress={() => openScreen({ screenId: SCREEN_ID })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  client.addScreen({ id: SCREEN_ID, title: "Worktrees", Component: WorktreesScreen });
  client.addSidebarHeaderItem({ id: SCREEN_ID, title: "Worktrees", Component: WorktreesItem });

  client.addCommandCenterItem({
    id: "new-worktree",
    title: "New worktree workspace…",
    icon: "GitBranchPlus",
    keywords: ["worktree", "workspace", "branch", "git"],
    context: "global",
    onSelect: ({ openScreen }) => openScreen({ screenId: SCREEN_ID }),
  });
  client.addCommandCenterItem({
    id: "new-worktree-in-project",
    title: "New worktree in this project…",
    icon: "GitBranchPlus",
    keywords: ["worktree", "workspace", "branch", "git"],
    context: "workspace",
    onSelect: ({ openScreen, workspace }) =>
      openScreen({ screenId: SCREEN_ID, params: { projectId: workspace.projectId } }),
  });

  client.addSlashCommand({
    name: "worktree",
    description: "Create a git worktree in this project and open it as a workspace",
    argumentHint: "<folder> [base-ref]",
    context: "workspace",
    async onSubmit({ args, workspace, rpc, openScreen }) {
      const [name, base] = args.split(/\s+/).filter(Boolean);
      if (!name) {
        openScreen({ screenId: SCREEN_ID, params: { projectId: workspace.projectId } });
        return;
      }
      const result = await rpc(createRpc, {
        projectId: workspace.projectId,
        name,
        mode: "new",
        base,
        fetch: true,
      });
      openScreen({ screenId: SCREEN_ID, params: { projectId: workspace.projectId, open: result.workspaceId } });
    },
  });

  return () => {};
}
