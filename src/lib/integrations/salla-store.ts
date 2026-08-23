import "server-only";
import { get, put } from "@vercel/blob";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CatalogProduct } from "@/lib/types";

export interface StoredSallaInstallation {
  storeId: string;
  merchantId: string;
  merchantPublicKey: string;
  merchantName: string;
  credentialRef: string;
  products: CatalogProduct[];
  connectedAt: string;
  lastSyncedAt: string;
}

export interface SallaInstallationState {
  version: 1;
  installations: StoredSallaInstallation[];
}

const blobPath = "private/nbeh/salla-installations.json";
const localPath = path.join(process.cwd(), ".demo-runtime", "salla-installations.json");

function emptyState(): SallaInstallationState {
  return { version: 1, installations: [] };
}

function validState(value: unknown): value is SallaInstallationState {
  const state = value as SallaInstallationState;
  return state?.version === 1 && Array.isArray(state.installations);
}

export async function readSallaInstallationState(): Promise<SallaInstallationState> {
  try {
    let contents: string;
    if (process.env.VERCEL) {
      const result = await get(blobPath, { access: "private" });
      if (!result?.stream) return emptyState();
      contents = await new Response(result.stream).text();
    } else {
      contents = await fs.readFile(localPath, "utf8");
    }
    const parsed: unknown = JSON.parse(contents);
    return validState(parsed) ? parsed : emptyState();
  } catch {
    return emptyState();
  }
}

export async function findSallaInstallation(storeId: string): Promise<StoredSallaInstallation | null> {
  const state = await readSallaInstallationState();
  return state.installations.find((installation) => installation.storeId === storeId) ?? null;
}

export async function writeSallaInstallation(installation: StoredSallaInstallation): Promise<void> {
  const state = await readSallaInstallationState();
  const next: SallaInstallationState = {
    version: 1,
    installations: [installation, ...state.installations.filter((item) => item.storeId !== installation.storeId)],
  };
  const contents = JSON.stringify(next);
  if (process.env.VERCEL) {
    await put(blobPath, contents, { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" });
    return;
  }
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  const temporary = `${localPath}.${process.pid}.tmp`;
  await fs.writeFile(temporary, contents, { encoding: "utf8", mode: 0o600 });
  await fs.rename(temporary, localPath);
}
