# Bare Worktrees for Paseo

**[English](#english) · [Русский](#russian)**

---

<a id="english"></a>

## English

A [Paseo](https://paseo.sh) plugin for people who keep their git worktrees under their own control.
One click creates a worktree in the folder you chose and opens it as a workspace of the Paseo project
you already have. One worktree, one workspace.

- [Why you might want it](#why-you-might-want-it)
- [What it does](#what-it-does)
- [Examples](#examples)
- [Paseo-managed worktrees vs. this plugin](#paseo-managed-worktrees-vs-this-plugin)
- [Requirements](#requirements)
- [Install](#install)
- [Setting up a bare repository](#setting-up-a-bare-repository)
- [Per-project configuration](#per-project-configuration)
- [Safety](#safety)
- [FAQ](#faq)
- [Limitations](#limitations)
- [Development](#development)

### Why you might want it

Running several coding agents at once only works if each one has its own checkout. Git worktrees
give you that, and Paseo can create them. The catch is where they end up and who owns them:

- Paseo puts managed worktrees under `~/.paseo/worktrees/<hash>/…`, and other agent tools keep their
  own folders, such as `.claude/worktrees/` inside the repository. Your worktrees end up scattered,
  away from your IDE, your scripts and your terminal multiplexer layout.
- When a Paseo-managed workspace is archived, including automatically after its branch is merged,
  Paseo removes the worktree folder and its branch.
- Many developers use the **bare repository layout**: one project folder with `.bare/` inside and a
  sibling folder per branch. These worktrees already exist, and you want them as workspaces of one
  project, not as a separate Paseo project per folder.

This plugin keeps you in charge. It runs `git worktree` itself, puts the folder where you said, and
registers that folder as a workspace of the existing project. Paseo uses the folder; it never owns
it, so archiving a workspace leaves your files and branch alone.

You probably want this plugin if:

- you work with a bare repository and `my-project/<branch-folder>` worktrees;
- you want every task or agent in its own worktree, in a predictable place;
- you already create worktrees with scripts or tools like herdr and want Paseo to pick them up;
- you do not want branches or folders to disappear when a workspace is archived.

### What it does

```text
my-project/              <- Paseo project
├── .bare/               <- bare repository
├── develop/             <- worktree -> workspace "develop"
├── release-1.2/         <- worktree -> workspace "release-1.2"
└── feature-payments/    <- worktree -> workspace "feature-payments"  (created by the plugin)
```

- **Worktrees screen.** Open it from the sidebar, or with **New worktree workspace…** in the Command
  Center (⌘K / Ctrl+K). Pick a project, then:
  - create a worktree on a **new branch** from a base ref, or on an **existing branch** (local or on
    `origin`);
  - change the parent folder for a single worktree; the screen shows the final path before you
    create it;
  - see every worktree of the project with its branch and whether it is in Paseo;
  - **Attach** worktrees that Paseo does not know yet, **Open**, **Detach** or **Remove** them.
- **New worktree in this project…** in the Command Center opens the same screen for the current
  project.
- **`/worktree <folder> [base-ref]`** in a workspace composer creates the worktree on a new branch
  named after the folder and opens it. Without arguments it opens the Worktrees screen.

Repository detection works from the Paseo project root, in this order: `.bare/`, then `.git`
(a directory or a `gitdir:` file), then the first child folder that is a regular checkout. So the
plugin also works with a plain clone, and with a layout like `client/main-repo/` plus sibling
worktrees `client/feature-x/`.

### Examples

**Start a big task in its own worktree.** In any workspace of the project, type:

```text
/worktree feature-payments
```

The plugin fetches `origin`, creates `my-project/feature-payments` on a new branch
`feature-payments` from `origin/develop` (or your configured base), adds it to the project and opens
it. Start Claude Code, Codex or any other agent there.

**Fix a release.** Branch off the release instead of the default base:

```text
/worktree hotfix-1.2.1 origin/release/1.2
```

**Use a different branch name than the folder name.** On the Worktrees screen, set *Folder name*
to `payments` and *New branch* to `feature/JIRA-123-payments`. The folder stays short, and the
branch follows your team's naming.

**Review someone else's branch.** Choose *Existing branch*, enter `feature/login-form`. If the
branch exists only on `origin`, the plugin creates a local tracking branch and checks it out in a
new worktree.

**Compare two agents on the same task.** Create `payments-claude` and `payments-codex` from the
same base, start a different agent in each workspace, and compare the diffs side by side.

**Bring in worktrees you already have.** Created worktrees from the terminal or another tool? Open
the Worktrees screen: they appear with *not in Paseo*. Press **Attach**, and each becomes a workspace
of the project.

**Clean up after a merge.** Press **Remove…**, then **Remove folder + branch**. The folder goes away,
the workspace is archived, and the branch is deleted only if git considers it merged.

**Keep worktrees in a separate folder.** Put this in the project root:

```json
{ "worktreesDir": "worktrees" }
```

New worktrees now go to `my-project/worktrees/<folder>`.

### Paseo-managed worktrees vs. this plugin

| | Paseo-managed worktree | Bare Worktrees |
| --- | --- | --- |
| Location | `~/.paseo/worktrees/<hash>/…` (one global root) | Project root or any folder you choose, per project or per worktree |
| Existing worktrees | CLI only: `paseo workspace create --project <id> --path …` | **Attach** button; new worktrees are attached on creation |
| Bare repository layout | Worktrees go to the global root, not next to `.bare/` | Worktrees live next to `.bare/` |
| Archive the workspace | Removes the folder and the branch | Folder and branch stay on disk |
| Auto-archive after merge | Removes the folder and the branch | Workspace archived, folder and branch stay |
| Setup and teardown hooks (`paseo.json`) | Yes | No, run your own scripts |

Both can live side by side: the plugin does not change how Paseo's own worktree workspaces behave.

### Requirements

- Paseo daemon and app **0.11.2** or newer.
- Plugins enabled on the daemon: **Settings → Plugins**.
- `git` on the machine that runs the Paseo daemon. Fetching uses that machine's git credentials and
  never prompts for a password.

### Install

From GitHub:

```bash
paseo plugin install github:vkrishtal91/paseo-bare-worktrees
```

From a local clone:

```bash
git clone https://github.com/vkrishtal91/paseo-bare-worktrees.git
paseo plugin install "$PWD/paseo-bare-worktrees"
```

Then add the folder that contains `.bare/` (or your checkout) as a Paseo project, and open
**Worktrees** in the sidebar.

### Setting up a bare repository

If you do not use the bare layout yet:

```bash
mkdir my-project && cd my-project
git clone --bare git@github.com:acme/my-project.git .bare
echo "gitdir: ./.bare" > .git
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch origin
git worktree add develop develop
```

Add `my-project/` to Paseo as a project. The plugin finds `.bare/` and lists `develop` on the
Worktrees screen; press **Attach** to make it a workspace.

### Per-project configuration

Optional `.paseo-worktrees.json` in the project root:

```json
{
  "worktreesDir": ".",
  "base": "origin/develop",
  "protectedBranches": ["main", "master", "develop", "release/*"]
}
```

| Field | Default | Meaning |
| --- | --- | --- |
| `worktreesDir` | project root | Parent folder for new worktrees, relative to the project root or absolute. |
| `base` | `origin/HEAD`, then `origin/develop`, `origin/main`, `origin/master` | Base ref for new branches. |
| `protectedBranches` | `main`, `master`, `develop`, `release/*` | Worktrees on these branches cannot be removed, and these branches are never deleted. A trailing `*` matches a prefix. |
| `gitDir` | auto-detected | Git directory to run worktree commands against. |

### Safety

- **Detach** only archives the Paseo workspace. The folder and branch stay.
- **Remove** refuses when the worktree has uncommitted or untracked files, and refuses worktrees on
  protected branches. It never passes `--force` to git.
- **Remove folder + branch** deletes the branch with `git branch -d`, so git keeps unmerged branches.
- If git refuses to remove the folder, the workspace stays attached.
- The plugin never pushes, never rewrites history and never touches remote branches. The only network
  call is `git fetch origin`, which you can switch off on the Worktrees screen.

### FAQ

**Will Paseo delete my worktree when it auto-archives a merged workspace?**
No. Workspaces created by this plugin are directory workspaces. Paseo archives them, but the folder
and branch stay. This was verified on Paseo 0.11.2.

**Can two workspaces point to the same worktree?**
The plugin avoids it: attaching a folder that already has an active workspace returns the existing
workspace instead of creating a second one.

**Does it work with a remote daemon?**
Yes. Paths, git and credentials are those of the daemon machine, not the device you are clicking on.

**I archived a workspace by mistake.**
The folder is still there. Open the Worktrees screen and press **Attach**.

### Limitations

- Only the `origin` remote is used for fetching and for existing-branch checkout.
- Folder names may contain Latin letters, digits, `.`, `_` and `-`, and must start with a letter or digit.
- No setup hooks: install dependencies or copy `.env` files with your own scripts.
- Archived workspaces remain in Paseo's history, as with any archived workspace.

### Development

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"     # first time
paseo plugin reload bare-worktrees
paseo plugin logs bare-worktrees
```

`index.server.ts` and `server/` run in the daemon (git and the Paseo SDK), `index.client.tsx` and
`client/` run in the app, and `shared/` holds the RPC contracts used by both.

### License

[MIT](LICENSE)

---

<a id="russian"></a>

## Русский

Плагин для [Paseo](https://paseo.sh) для тех, кто хочет сам управлять своими git worktree. Одной
кнопкой он создаёт worktree в выбранной вами папке и открывает его как workspace уже существующего
проекта Paseo. Один worktree — один workspace.

- [Зачем он нужен](#зачем-он-нужен)
- [Что умеет](#что-умеет)
- [Примеры](#примеры)
- [Чем отличается от worktree, которые создаёт Paseo](#чем-отличается-от-worktree-которые-создаёт-paseo)
- [Требования](#требования)
- [Установка](#установка)
- [Как перейти на bare-репозиторий](#как-перейти-на-bare-репозиторий)
- [Настройки проекта](#настройки-проекта)
- [Безопасность](#безопасность)
- [Частые вопросы](#частые-вопросы)
- [Ограничения](#ограничения)
- [Разработка](#разработка)

### Зачем он нужен

Чтобы несколько агентов работали параллельно и не мешали друг другу, каждому нужна своя рабочая
копия. Для этого и существуют git worktree, и Paseo умеет их создавать. Проблема в том, где они
оказываются и кто ими распоряжается:

- Paseo складывает свои worktree в `~/.paseo/worktrees/<hash>/…`, а другие агентские инструменты
  держат их в своих папках, например `.claude/worktrees/` внутри репозитория. В итоге worktree
  разбросаны по диску, далеко от IDE, скриптов и раскладки терминала.
- Когда workspace с worktree от Paseo архивируется, в том числе автоматически после мержа ветки,
  Paseo удаляет и папку worktree, и ветку.
- Многие работают с **bare-репозиторием**: одна папка проекта, внутри `.bare/` и по соседней папке на
  каждую ветку. Эти worktree уже есть, и хочется видеть их как workspace одного проекта, а не как
  отдельный проект Paseo на каждую папку.

Плагин оставляет управление вам. Он сам запускает `git worktree`, кладёт папку туда, куда вы
сказали, и подключает её к существующему проекту как workspace. Paseo работает с этой папкой, но не
владеет ей, поэтому архивация workspace не трогает ни файлы, ни ветку.

Плагин вам пригодится, если:

- вы работаете с bare-репозиторием и папками вида `my-project/<ветка>`;
- хотите, чтобы у каждой задачи или агента был свой worktree в предсказуемом месте;
- уже создаёте worktree скриптами или инструментами вроде herdr и хотите, чтобы Paseo их подхватил;
- не хотите, чтобы ветки и папки пропадали при архивации workspace.

### Что умеет

```text
my-project/              <- проект Paseo
├── .bare/               <- bare-репозиторий
├── develop/             <- worktree -> workspace "develop"
├── release-1.2/         <- worktree -> workspace "release-1.2"
└── feature-payments/    <- worktree -> workspace "feature-payments"  (создан плагином)
```

- **Экран Worktrees.** Открывается из бокового меню или командой **New worktree workspace…** в
  Command Center (⌘K / Ctrl+K). Выбираете проект, после чего можно:
  - создать worktree на **новой ветке** от базовой или на **существующей ветке** (локальной или с
    `origin`);
  - для отдельного worktree указать другую родительскую папку; итоговый путь виден до создания;
  - посмотреть все worktree проекта, их ветки и подключены ли они к Paseo;
  - **подключить** (Attach) worktree, о которых Paseo ещё не знает, а также **открыть** (Open),
    **отключить** (Detach) или **удалить** (Remove).
- Команда **New worktree in this project…** в Command Center открывает тот же экран сразу для
  текущего проекта.
- **`/worktree <папка> [базовая-ветка]`** в поле ввода workspace создаёт worktree на новой ветке с
  именем папки и открывает его. Без аргументов команда открывает экран Worktrees.

Репозиторий ищется от корня проекта Paseo в таком порядке: `.bare/`, затем `.git` (папка или файл со
строкой `gitdir:`), затем первая вложенная папка с обычным клоном. Поэтому плагин работает и с
обычным клоном, и с раскладкой вида `client/main-repo/` с worktree по соседству (`client/feature-x/`).

### Примеры

**Начать большую задачу в отдельном worktree.** В любом workspace проекта напишите:

```text
/worktree feature-payments
```

Плагин сделает `git fetch origin`, создаст `my-project/feature-payments` на новой ветке
`feature-payments` от `origin/develop` (или от базовой ветки из настроек), добавит его в проект и
откроет. Дальше запускайте там Claude Code, Codex или любого другого агента.

**Исправить релиз.** Ответвитесь от релизной ветки вместо базовой по умолчанию:

```text
/worktree hotfix-1.2.1 origin/release/1.2
```

**Назвать ветку иначе, чем папку.** На экране Worktrees укажите в *Folder name* `payments`, а в
*New branch* `feature/JIRA-123-payments`. Папка останется короткой, а ветка будет названа по
правилам команды.

**Посмотреть чужую ветку.** Выберите *Existing branch* и введите `feature/login-form`. Если ветка
есть только на `origin`, плагин создаст локальную ветку, связанную с удалённой, и откроет её в новом
worktree.

**Сравнить двух агентов на одной задаче.** Создайте `payments-claude` и `payments-codex` от одной
базы, запустите в каждом workspace своего агента и сравните результаты.

**Подключить уже существующие worktree.** Создавали worktree из терминала или другим инструментом?
Откройте экран Worktrees: они будут помечены *not in Paseo*. Нажмите **Attach**, и каждый станет
workspace проекта.

**Прибраться после мержа.** Нажмите **Remove…**, затем **Remove folder + branch**. Папка удалится,
workspace уйдёт в архив, а ветка удалится, только если git считает её слитой.

**Держать worktree в отдельной папке.** Положите в корень проекта файл `.paseo-worktrees.json`:

```json
{ "worktreesDir": "worktrees" }
```

Новые worktree будут появляться в `my-project/worktrees/<папка>`.

### Чем отличается от worktree, которые создаёт Paseo

| | Worktree от Paseo | Bare Worktrees |
| --- | --- | --- |
| Где лежит | `~/.paseo/worktrees/<hash>/…` (один общий корень) | В корне проекта или в любой папке: для всего проекта или для отдельного worktree |
| Существующие worktree | Только через CLI: `paseo workspace create --project <id> --path …` | Кнопка **Attach**; новые worktree подключаются сразу |
| Bare-репозиторий | Worktree уходят в общий корень, а не рядом с `.bare/` | Worktree лежат рядом с `.bare/` |
| Архивация workspace | Удаляет папку и ветку | Папка и ветка остаются |
| Автоархивация после мержа | Удаляет папку и ветку | Workspace архивируется, папка и ветка остаются |
| Хуки setup и teardown (`paseo.json`) | Есть | Нет, используйте свои скрипты |

Одно не мешает другому: плагин не меняет поведение worktree, которые создаёт сам Paseo.

### Требования

- Демон и приложение Paseo версии **0.11.2** или новее.
- Плагины включены на демоне: **Settings → Plugins**.
- `git` на машине, где работает демон Paseo. `git fetch` использует git-доступы этой машины и
  никогда не спрашивает пароль.

### Установка

С GitHub:

```bash
paseo plugin install github:vkrishtal91/paseo-bare-worktrees
```

Из локального клона:

```bash
git clone https://github.com/vkrishtal91/paseo-bare-worktrees.git
paseo plugin install "$PWD/paseo-bare-worktrees"
```

Затем добавьте в Paseo как проект папку, в которой лежит `.bare/` (или ваш клон), и откройте
**Worktrees** в боковом меню.

### Как перейти на bare-репозиторий

Если вы ещё не используете такую раскладку:

```bash
mkdir my-project && cd my-project
git clone --bare git@github.com:acme/my-project.git .bare
echo "gitdir: ./.bare" > .git
git config remote.origin.fetch "+refs/heads/*:refs/remotes/origin/*"
git fetch origin
git worktree add develop develop
```

Добавьте `my-project/` в Paseo как проект. Плагин найдёт `.bare/` и покажет `develop` на экране
Worktrees; нажмите **Attach**, чтобы сделать его workspace.

### Настройки проекта

Необязательный файл `.paseo-worktrees.json` в корне проекта:

```json
{
  "worktreesDir": ".",
  "base": "origin/develop",
  "protectedBranches": ["main", "master", "develop", "release/*"]
}
```

| Поле | По умолчанию | Что задаёт |
| --- | --- | --- |
| `worktreesDir` | корень проекта | Родительская папка для новых worktree: относительно корня проекта или абсолютный путь. |
| `base` | `origin/HEAD`, затем `origin/develop`, `origin/main`, `origin/master` | Базовая ветка для новых веток. |
| `protectedBranches` | `main`, `master`, `develop`, `release/*` | Worktree на этих ветках нельзя удалить, а сами ветки плагин не удаляет никогда. `*` в конце означает «любое продолжение». |
| `gitDir` | определяется автоматически | Git-каталог, с которым работают команды `git worktree`. |

### Безопасность

- **Detach** только архивирует workspace в Paseo. Папка и ветка остаются.
- **Remove** отказывается удалять worktree с незакоммиченными или неотслеживаемыми файлами, а также
  worktree на защищённых ветках. Флаг `--force` плагин не использует никогда.
- **Remove folder + branch** удаляет ветку через `git branch -d`, поэтому неслитые ветки git не
  удалит.
- Если git отказался удалять папку, workspace остаётся подключённым.
- Плагин ничего не пушит, не переписывает историю и не трогает удалённые ветки. Единственное
  обращение к сети — `git fetch origin`, его можно выключить на экране Worktrees.

### Частые вопросы

**Удалит ли Paseo мой worktree при автоархивации после мержа?**
Нет. Плагин подключает worktree как обычные папки. Paseo их архивирует, но папка и ветка остаются.
Проверено на Paseo 0.11.2.

**Могут ли два workspace указывать на один worktree?**
Плагин этого не допускает: если у папки уже есть активный workspace, Attach вернёт его, а не создаст
второй.

**Работает ли плагин с удалённым демоном?**
Да. Пути, git и доступы берутся с машины, где работает демон, а не с устройства, на котором вы
нажимаете кнопки.

**Я случайно заархивировал workspace.**
Папка на месте. Откройте экран Worktrees и нажмите **Attach**.

### Ограничения

- Для `fetch` и для существующих веток используется только remote `origin`.
- В имени папки допустимы латинские буквы, цифры, `.`, `_` и `-`; начинаться оно должно с буквы или цифры.
- Хуков setup нет: зависимости и файлы `.env` копируйте своими скриптами.
- Заархивированные workspace остаются в истории Paseo, как и любые другие.

### Разработка

```bash
npm install
npm run typecheck
paseo plugin install "$PWD"     # в первый раз
paseo plugin reload bare-worktrees
paseo plugin logs bare-worktrees
```

`index.server.ts` и `server/` работают в демоне (git и Paseo SDK), `index.client.tsx` и `client/` — в
приложении, а в `shared/` лежат RPC-контракты, общие для обеих частей.

### Лицензия

[MIT](LICENSE)
