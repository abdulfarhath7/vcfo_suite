# SharePoint client folders

Ask VCFO reads a client's folder in the firm's SharePoint (`/Clients/<client>`) when a person asks,
for example "take data of Kestrel from SharePoint". The files go through the drop pipeline
(`docs/context/notes/ask-do.md`), so they end on one review card and nothing is saved until the
person accepts. Built 24 Nov 2026 on `feat/sharepoint`.

## How it connects

- There is no separate "Connect SharePoint" button. The Outlook connection asks for two more
  delegated scopes, `Files.Read.All` and `Sites.Read.All` (`src/lib/outlook/oauth.ts`). SharePoint is
  read as the person, so they see only the folders SharePoint lets them open.
- `outlook_connections.scopes` stores what Microsoft granted. A row made before 24 Nov 2026 has null
  there: its refresh keeps asking for the four older scopes only, because a refresh that asks for a
  scope the person never consented to is refused, and that would stop their email too. Such a person
  sees "SharePoint: Needs reconnect" in Settings, Email, and the chat tells them to reconnect.
- The two file scopes are asked for only while `SHAREPOINT_SITE_URL` is set, so the code can ship
  before the Azure app has the permissions. Add the two delegated permissions to the Azure app
  registration first, then set the site URL, or the reconnect fails at Microsoft's consent page.
- `SHAREPOINT_SITE_URL` and `SHAREPOINT_CLIENTS_PATH` (default `/Clients`) say where the folders are
  (`src/lib/sharepoint/config.ts`). With no site URL, SharePoint is hidden everywhere.
- The path may start with a document library's name. SBC's folders sit at site
  `https://steadfastconsultants.sharepoint.com/sites/steadfast_files`, library "SteadFast", folder
  "Clients", so production sets `SHAREPOINT_CLIENTS_PATH=SteadFast/Clients`. `libraryCandidates`
  (`src/lib/sharepoint/library.ts`) first tries a library named by the first segment (display name or
  URL name) with the rest of the path, then the default library with the full path. Both values are
  Terraform variables in `infra/sharepoint.tf`, set in `infra/terraform.tfvars`.

## How a fetch runs

- `sharepoint.fetch` is a T1 action in `src/lib/actions/sharepoint/`. The chat picker
  (`src/lib/ask/do/pick-action.ts`) locks the client inside the person's scope first and then calls
  `startSharepointDrop` (`src/lib/sharepoint/start-drop.ts`). No Graph call happens for a client the
  person cannot reach.
- The project's folder: the stored link on `engagements.sharepoint_*` when it still opens, else the
  one folder under Clients whose name matches the client without suffixes
  (`src/lib/sharepoint/match.ts`), which is then linked. Two or no matches are never guessed: the
  chat asks the person to pick the folder in the SHAREPOINT control on the project's head
  (`SharepointFolderControl`, route `GET/PUT /api/engagements/:id/sharepoint`). Only a folder
  directly under Clients can be linked.
- The drop job has a first step, `dropPullStep` (`src/lib/ask/drop/sharepoint-pull.ts`), that walks
  the folder and its sub-folders and copies each file into the drop as an `ask_attachments` row with
  the SharePoint path as `relative_path`. Every later step is the upload path unchanged. The drop
  limits hold: 50 files, 200 MB, 25 MB a file, the drop's file types. Anything else is listed in the
  closing message with a reason. A retry does not copy a file twice (same path).
- The folder's Graph ids stay on the project row, never in the run state, because the run state is
  masked and a drive id could look like an identity number.
- Nothing writes to SharePoint. The scopes are read only.

## Testing

- Unit tests: `src/lib/sharepoint/*.test.ts`, `src/lib/ask/drop/sharepoint-pull.test.ts`, the
  SharePoint cases in `src/lib/ask/drop/run.test.ts` and `src/lib/ask/do/pick-action.test.ts`.
- A real run needs the Azure permissions, the env vars, and a reconnect on the dev server.

## Asking again, and not paying twice (migration 0069)

- `sharepoint_files_seen` holds one row per project and SharePoint item: its content tag (`cTag`),
  the sha256 of its bytes, the attachment it was copied into, and `read_key`, the S3 key of the stored
  read. Repository: `src/db/repositories/sharepoint-files-seen.ts`, scoped by `assertEngagementAccess`.
- A fetch leaves out a file that an earlier fetch read (`read_key` set) and whose `cTag` is the same,
  and only counts it (`walkFolder`'s `isSeen`), so the 50 places go to new files and "ask again"
  moves through a large folder. A file copied but never read (a failed run) is not counted as seen.
- The read step (`dropReadStep`) first looks for a stored read of the same bytes on the same project
  and reuses it with no model call; every new read stores its key on the row.
- A discarded card does not undo "seen": its files are left out of the next fetch. To fetch them
  again, change the file in SharePoint or clear the project's rows.
- A chat message that starts a fetch turns on the progress bar (`AskProvider`, answer with `runId`
  and no `changesetId`); the copy step reports "Copying files from SharePoint, n of N".
- A card's content hash is taken over its rows as Postgres stores them (`createAskChangeset`) and
  skips `undefined` keys (`changeset/hash.ts`); before 64b455b4 a card made in memory could never
  be saved ("This card changed after you saw it").

