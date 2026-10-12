import type { PluginTheme } from "@getpaseo/plugin";
import type { PluginScreenProps } from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { ScrollView, TextInput, useToast } from "@getpaseo/plugin/client/react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import {
  attachRpc,
  createRpc,
  detachRpc,
  overviewRpc,
  removeRpc,
  type ProjectOverview,
  type Worktree,
} from "../shared/contracts";

export const SCREEN_ID = "worktrees";

const OVERVIEW_KEY = ["worktrees", "overview"];

function makeStyles(theme: PluginTheme, compact: boolean) {
  const c = theme.colors;
  return {
    screen: { flex: 1, backgroundColor: c.surface0 },
    content: { padding: compact ? 16 : 24, gap: 16 },
    card: { gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface1 },
    title: { color: c.foreground, fontSize: 16, fontWeight: "600" as const },
    text: { color: c.foreground },
    muted: { color: c.foregroundMuted, fontSize: 12 },
    danger: { color: c.statusDanger },
    row: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, alignItems: "center" as const },
    input: {
      color: c.foreground,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      backgroundColor: c.surface0,
    },
    chip: (active: boolean) => ({
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: active ? c.accent : c.border,
      backgroundColor: active ? c.accent : c.surface1,
    }),
    chipText: (active: boolean) => ({ color: active ? c.accentForeground : c.foreground }),
    button: (kind: "primary" | "plain" | "danger", disabled = false) => ({
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      opacity: disabled ? 0.5 : 1,
      borderColor: kind === "primary" ? c.accent : kind === "danger" ? c.statusDanger : c.border,
      backgroundColor: kind === "primary" ? c.accent : c.surface1,
    }),
    buttonText: (kind: "primary" | "plain" | "danger") => ({
      color: kind === "primary" ? c.accentForeground : kind === "danger" ? c.statusDanger : c.foreground,
    }),
    worktreeRow: { gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: c.border },
  };
}
type Styles = ReturnType<typeof makeStyles>;

function Button(props: {
  styles: Styles;
  label: string;
  kind?: "primary" | "plain" | "danger";
  disabled?: boolean;
  onPress(): void;
}) {
  const kind = props.kind ?? "plain";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      disabled={props.disabled}
      onPress={props.onPress}
      style={props.styles.button(kind, props.disabled)}
    >
      <Text style={props.styles.buttonText(kind)}>{props.label}</Text>
    </Pressable>
  );
}

function Field(props: {
  styles: Styles;
  label: string;
  value: string;
  placeholder?: string;
  onChange(text: string): void;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={props.styles.muted}>{props.label}</Text>
      <TextInput
        value={props.value}
        placeholder={props.placeholder}
        onChangeText={props.onChange}
        autoCapitalize="none"
        autoCorrect={false}
        style={props.styles.input}
      />
    </View>
  );
}

export function WorktreesScreen({ theme, layout, params, navigation }: PluginScreenProps) {
  const styles = useMemo(() => makeStyles(theme, layout.compact), [theme, layout.compact]);
  const toast = useToast();
  const queryClient = useQueryClient();
  const fetchOverview = useRpc(overviewRpc);
  const createWorktree = useRpc(createRpc);
  const attachWorktree = useRpc(attachRpc);
  const detachWorkspace = useRpc(detachRpc);
  const removeWorktree = useRpc(removeRpc);

  const overview = useQuery({ queryKey: OVERVIEW_KEY, queryFn: () => fetchOverview({}) });
  const projects = overview.data?.projects ?? [];
  const [projectId, setProjectId] = useState<string | null>(params.projectId ?? null);
  const project: ProjectOverview | undefined =
    projects.find((p) => p.projectId === projectId) ?? projects.find((p) => p.gitDir);

  const [name, setName] = useState("");
  const [branch, setBranch] = useState("");
  const [base, setBase] = useState("");
  const [parentDir, setParentDir] = useState("");
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [fetch, setFetch] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Opened by the slash command after it created a workspace.
  useEffect(() => {
    if (params.open) navigation?.openWorkspace({ workspaceId: params.open });
  }, [params.open, navigation]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
  const onError = (error: unknown) => toast.error((error as Error).message);

  const create = useMutation({
    mutationFn: createWorktree,
    onSuccess: (result) => {
      toast.show(`Created ${result.path} on ${result.branch}`, { variant: "success" });
      setName("");
      setBranch("");
      void refresh();
      navigation?.openWorkspace({ workspaceId: result.workspaceId });
    },
    onError,
  });
  const attach = useMutation({
    mutationFn: attachWorktree,
    onSuccess: ({ workspaceId }) => {
      void refresh();
      navigation?.openWorkspace({ workspaceId });
    },
    onError,
  });
  const detach = useMutation({ mutationFn: detachWorkspace, onSuccess: () => void refresh(), onError });
  const remove = useMutation({
    mutationFn: removeWorktree,
    onSuccess: ({ deletedBranch }) => {
      toast.show(deletedBranch ? `Removed worktree and branch ${deletedBranch}` : "Removed worktree", {
        variant: "success",
      });
      setConfirmRemove(null);
      void refresh();
    },
    onError,
  });
  const busy = create.isPending || attach.isPending || detach.isPending || remove.isPending;

  const targetPreview = project ? `${parentDir.trim() || project.worktreesDir}/${name.trim() || "<folder>"}` : "";

  function submit() {
    if (!project || !name.trim()) return;
    create.mutate({
      projectId: project.projectId,
      name: name.trim(),
      mode,
      branch: branch.trim() || undefined,
      base: mode === "new" ? base.trim() || undefined : undefined,
      worktreesDir: parentDir.trim() || undefined,
      fetch,
    });
  }

  function renderWorktree(wt: Worktree) {
    if (!project) return null;
    const confirming = confirmRemove === wt.path;
    return (
      <View key={wt.path} style={styles.worktreeRow}>
        <Text style={styles.text}>{wt.label}</Text>
        <Text style={styles.muted}>
          {wt.branch ?? `detached ${wt.head ?? ""}`}
          {wt.workspaceId ? "  ·  workspace" : "  ·  not in Paseo"}
        </Text>
        <View style={styles.row}>
          {wt.workspaceId ? (
            <>
              <Button
                styles={styles}
                label="Open"
                onPress={() => navigation?.openWorkspace({ workspaceId: wt.workspaceId! })}
              />
              <Button
                styles={styles}
                label="Detach"
                disabled={busy}
                onPress={() => detach.mutate({ workspaceId: wt.workspaceId! })}
              />
            </>
          ) : (
            <Button
              styles={styles}
              label="Attach"
              kind="primary"
              disabled={busy}
              onPress={() => attach.mutate({ projectId: project.projectId, path: wt.path })}
            />
          )}
          {confirming ? (
            <>
              <Button
                styles={styles}
                label="Remove folder"
                kind="danger"
                disabled={busy}
                onPress={() => remove.mutate({ projectId: project.projectId, path: wt.path, deleteBranch: false })}
              />
              <Button
                styles={styles}
                label="Remove folder + branch"
                kind="danger"
                disabled={busy}
                onPress={() => remove.mutate({ projectId: project.projectId, path: wt.path, deleteBranch: true })}
              />
              <Button styles={styles} label="Cancel" onPress={() => setConfirmRemove(null)} />
            </>
          ) : (
            <Button styles={styles} label="Remove…" kind="danger" onPress={() => setConfirmRemove(wt.path)} />
          )}
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {overview.isLoading ? <Text style={styles.muted}>Loading projects…</Text> : null}
      {overview.error ? <Text style={styles.danger}>{(overview.error as Error).message}</Text> : null}

      <View style={styles.row}>
        {projects.map((p) => {
          const active = p.projectId === project?.projectId;
          return (
            <Pressable
              key={p.projectId}
              accessibilityRole="button"
              accessibilityLabel={`Select project ${p.name}`}
              onPress={() => setProjectId(p.projectId)}
              style={styles.chip(active)}
            >
              <Text style={styles.chipText(active)}>{p.name}</Text>
            </Pressable>
          );
        })}
        <Button styles={styles} label="Refresh" onPress={() => void refresh()} />
      </View>

      {project ? (
        <>
          <View style={styles.card}>
            <Text style={styles.title}>New worktree in {project.name}</Text>
            {project.error ? <Text style={styles.danger}>{project.error}</Text> : null}
            <Text style={styles.muted}>
              {project.bare ? "Bare repository" : "Repository"}: {project.gitDir ?? "not found"}
            </Text>
            <View style={styles.row}>
              {(["new", "existing"] as const).map((m) => (
                <Pressable
                  key={m}
                  accessibilityRole="button"
                  accessibilityLabel={m === "new" ? "New branch" : "Existing branch"}
                  onPress={() => setMode(m)}
                  style={styles.chip(mode === m)}
                >
                  <Text style={styles.chipText(mode === m)}>{m === "new" ? "New branch" : "Existing branch"}</Text>
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: fetch }}
                accessibilityLabel="Fetch origin first"
                onPress={() => setFetch(!fetch)}
                style={styles.chip(fetch)}
              >
                <Text style={styles.chipText(fetch)}>{fetch ? "✓ " : ""}Fetch origin</Text>
              </Pressable>
            </View>
            <Field styles={styles} label="Folder name" value={name} placeholder="login-form" onChange={setName} />
            <Field
              styles={styles}
              label={mode === "new" ? "New branch (defaults to folder name)" : "Existing branch (local or origin)"}
              value={branch}
              placeholder={name.trim() || "feature/login-form"}
              onChange={setBranch}
            />
            {mode === "new" ? (
              <Field
                styles={styles}
                label="Base ref"
                value={base}
                placeholder={project.defaultBase ?? "origin/main"}
                onChange={setBase}
              />
            ) : null}
            <Field
              styles={styles}
              label="Parent folder"
              value={parentDir}
              placeholder={project.worktreesDir}
              onChange={setParentDir}
            />
            <Text style={styles.muted}>→ {targetPreview}</Text>
            <View style={styles.row}>
              <Button
                styles={styles}
                label={create.isPending ? "Creating…" : "Create worktree + workspace"}
                kind="primary"
                disabled={busy || !name.trim() || !project.gitDir}
                onPress={submit}
              />
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.title}>Worktrees</Text>
            {project.worktrees.length === 0 ? <Text style={styles.muted}>No worktrees</Text> : null}
            {project.worktrees.map(renderWorktree)}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
