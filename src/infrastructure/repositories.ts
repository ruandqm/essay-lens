import { promises as fs } from "node:fs";
import path from "node:path";
import { DatasetEssaySchema, type DatasetEssay, type ExperimentRun } from "@/application/experiments/types";
import type { ExperimentRepository, KnowledgeIndexRepository } from "@/application/ports";
import type { KnowledgeIndex } from "@/domain/knowledge";

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/** Escrita atômica: grava em arquivo temporário e renomeia. */
async function writeJson(file: string, data: unknown, pretty = true) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, pretty ? 2 : 0));
  await fs.rename(tmp, file);
}

export class FileKnowledgeIndexRepository implements KnowledgeIndexRepository {
  constructor(private readonly file: string) {}
  load() {
    return readJson<KnowledgeIndex>(this.file);
  }
  save(index: KnowledgeIndex) {
    return writeJson(this.file, index, false);
  }
}

export class FileExperimentRepository implements ExperimentRepository {
  constructor(
    private readonly datasetFile: string,
    private readonly runsDir: string,
  ) {}

  async listDataset() {
    const raw = (await readJson<unknown[]>(this.datasetFile)) ?? [];
    return raw.map((x) => DatasetEssaySchema.parse(x));
  }
  saveDataset(items: DatasetEssay[]) {
    return writeJson(this.datasetFile, items);
  }
  async listRuns() {
    try {
      const files = (await fs.readdir(this.runsDir)).filter((f) => f.endsWith(".json"));
      const runs = await Promise.all(files.map((f) => readJson<ExperimentRun>(path.join(this.runsDir, f))));
      return runs.filter((r): r is ExperimentRun => r !== null).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw err;
    }
  }
  getRun(id: string) {
    return readJson<ExperimentRun>(this.file(id));
  }
  saveRun(run: ExperimentRun) {
    return writeJson(this.file(run.id), run);
  }
  async deleteRun(id: string) {
    await fs.rm(this.file(id), { force: true });
  }
  private file(id: string) {
    if (!/^[\w-]+$/.test(id)) throw new Error("ID de execução inválido.");
    return path.join(this.runsDir, `${id}.json`);
  }
}
