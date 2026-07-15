import type { DirectorProject } from "../schema/directorProject";

export function parseProject(json: string): DirectorProject {
  return JSON.parse(json) as DirectorProject;
}
