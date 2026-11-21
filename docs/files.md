# Files and documents

People can keep documents (warranties, contracts, scans, a cookbook page) in idkjustfood. The files
are stored on the disk of the server that runs the API. They are never sent to a cloud storage
service, so a self-hosted install keeps everything on its own machine.

## Who can see a file

Every file belongs to the person who uploaded it and, when they choose, to one household.

| Uploaded as | Who can see and download it | Who can delete it |
| --- | --- | --- |
| Personal (no `householdId`) | Only the person who uploaded it. Not even the members of their households. | The same person. |
| Household (`householdId`) | Every member of that household. | The person who uploaded it, and the household's owners and admins. |

Asking for a file you may not see answers `404`, the same as a file that does not exist, so nobody
can find out which files exist.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| `FILES_DIR` | `./data/files` | The folder where files are kept. In Docker Compose it is `/data/files`, in the `files-data` volume. |
| `FILES_MAX_MB` | `25` | The largest file the server accepts, in megabytes. |
| `FILES_ALLOWED_TYPES` | PDF, images, plain text, CSV, Word, Excel and OpenDocument | Comma separated list of types. `image/*` allows every image type. |

## API

All endpoints need a signed-in user. They are listed in the OpenAPI document under "Files".

- `POST /api/files`: upload (multipart form with `file` and an optional `householdId`).
- `GET /api/files`: your files and those of your households. `?householdId=` limits it to one household.
- `GET /api/files/{fileId}`: the details of one file.
- `GET /api/files/{fileId}/content`: the file itself, as a download.
- `DELETE /api/files/{fileId}`: delete it, from the database and from the disk.

## How it is kept safe

- The file is saved under a generated name. The name the person gave is only stored in the database
  and is never used as a path, so `../../` tricks do nothing.
- Files are sent as downloads with `nosniff` and a sandbox policy, so a browser never runs them.
- Types are checked against the allowed list, and the size is checked before the file is read.

## Backups

Back up the files folder together with the database: the database knows which file is whose, the
folder holds the bytes. With Docker Compose, back up the `files-data` volume next to `postgres-data`.

If a user or household is deleted, their rows are removed from the database but the bytes stay in
the folder until they are cleaned up by hand. Nobody can reach them through the API.

## Adding another storage

The routes talk to the `FileStorage` interface (`apps/api/src/files/storage.ts`): `put`, `read` and
`remove`, all by a generated key. To keep files somewhere else, write an object that does these three
things and pass it as `storage` to `createApp` in `apps/api/src/index.ts`. The routes and access
rules do not change.

## In the app

The Documents module (Home) lists the files of the current space (personal or a household), uploads a
file from the phone or computer, opens it and deletes it. It needs a connection: documents are not
stored on the phone.
