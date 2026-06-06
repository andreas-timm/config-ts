import { homedir } from "node:os";
import { join } from "node:path";

export function resolveConfigFilePath(
    rootDir: string,
    fileName: string,
): string {
    if (fileName.startsWith("/")) {
        return fileName;
    }
    if (fileName.startsWith("~")) {
        const home = homedir();
        if (fileName === "~") {
            return home;
        }
        if (fileName.startsWith("~/") || fileName.startsWith("~\\")) {
            return join(home, fileName.slice(2));
        }
        return join(home, fileName.slice(1));
    }
    return join(rootDir, fileName);
}
