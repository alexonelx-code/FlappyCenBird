# Project conventions

- CenGames is a free, non-production hobby project. Prefer built-in browser and Python features over paid services or new dependencies.
- Keep files focused by responsibility. Split growing game, UI, and economy modules before they become monoliths.
- Keep code concise. Add comments only when they explain non-obvious behavior or a real constraint; do not use comments as narration.
- Keep `README.md` aligned with the actual browser storage, local SQLite API, catalogs, prices, and deployment workflow.
- When validating changes, run the standard-library Python tests and `node --check` for changed JavaScript files.
