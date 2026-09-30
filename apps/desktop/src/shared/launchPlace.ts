// Where an agent will actually start (UXA-C04).
//
// MEASURED at `29f084d`: the main process resolves the launch directory as
// `project.repo_path ?? app.getPath('home')` and the launcher shows a dropdown
// and a button. A project with no repository attached therefore starts an agent
// — with write tools — in the operator's HOME FOLDER, and nothing on the way
// there says so.
//
// The rule lives here rather than in `index.ts` for the reason M110 keeps
// producing: a derivation inside the main process is reachable only by
// launching the app, so nothing can plant against it and the surface has to
// restate it. A restated rule is a second rule.
//
// The HOME PATH is resolved by the main process and only there, which is
// correct — the renderer has no business knowing the machine's layout. What
// crosses is the CHOICE, and both sides read it from here.

export type LaunchPlace =
  | { place: 'repository'; path: string }
  /** No repository is attached, so the agent starts where the operator's own
   *  files are. The path is the main process's to resolve; what the surface
   *  needs to say is which KIND of place this is. */
  | { place: 'home' }

export function launchPlace(repoPath: string | null | undefined): LaunchPlace {
  return repoPath ? { place: 'repository', path: repoPath } : { place: 'home' }
}
