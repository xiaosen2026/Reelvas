import type { DirectorProject } from "../schema/directorProject";

export function serializeProject(project: DirectorProject) {
  return JSON.stringify(project, null, 2);
}
