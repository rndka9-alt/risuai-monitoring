import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from './config.js';
import { logger } from './logger.js';

// ── Types ──────────────────────────────────────────────────────────

export interface AssetIssue {
  field: string;
  assetName: string;
  assetPath: string;
}

export interface CharacterIssues {
  characterId: string;
  characterName: string;
  type: string;
  totalAssets: number;
  issues: AssetIssue[];
}

export interface ModuleIssues {
  moduleId: string;
  moduleName: string;
  totalAssets: number;
  issues: AssetIssue[];
}

export interface ValidationResult {
  totalCharacters: number;
  totalAssets: number;
  totalMissing: number;
  characters: CharacterIssues[];
  modules: ModuleIssues[];
  scannedAt: number;
}

// ── Constants ──────────────────────────────────────────────────────

const ASSET_TEMPLATE_REGEX =
  /\{\{(?:raw|path|img|image|video|audio|bgm|bg|emotion|asset|video-img)::(.+?)\}\}/gms;

/** Text fields in character JSON that can contain {{type::name}} templates. */
const TEXT_FIELDS = [
  'firstMessage',
  'desc',
  'notes',
  'personality',
  'scenario',
  'systemPrompt',
  'postHistoryInstructions',
  'exampleMessage',
  'additionalText',
  'backgroundHTML',
] as const;

/** Prefixes that indicate non-file asset URIs (skip validation). */
const SKIP_URI_PREFIXES = [
  'ccdefault:',
  'embeded://',
  'data:',
  'http://',
  'https://',
  '__asset:',
];

// ── Helpers ────────────────────────────────────────────────────────

interface AssetRef {
  field: string;
  name: string;
  path: string;
}

function isSkippableUri(uri: string): boolean {
  return SKIP_URI_PREFIXES.some((prefix) => uri.startsWith(prefix));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/**
 * RisuAI Node 서버는 파일 경로를 hex 인코딩해서 flat하게 저장한다.
 * e.g. "assets/abc.png" → "6173736574732f6162632e706e67"
 */
function hexDecode(hex: string): string | null {
  try {
    return Buffer.from(hex, 'hex').toString('utf-8');
  } catch {
    return null;
  }
}

// ── Save directory scan ────────────────────────────────────────────

interface SaveScan {
  assetPaths: Set<string>;
  characterHexNames: string[];
}

/**
 * /risuai-save/ 디렉터리를 한 번 스캔하여
 * 에셋 경로 Set과 캐릭터 파일 목록을 동시에 구축한다.
 */
async function scanSaveDirectory(): Promise<SaveScan> {
  const assetPaths = new Set<string>();
  const characterHexNames: string[] = [];

  try {
    const hexNames = await readdir(config.saveMountPath);
    for (const hexName of hexNames) {
      const decoded = hexDecode(hexName);
      if (!decoded) continue;

      if (decoded.startsWith('assets/')) {
        assetPaths.add(decoded);
      } else if (decoded.startsWith('remotes/') && decoded.endsWith('.local.bin')) {
        characterHexNames.push(hexName);
      }
    }
  } catch {
    logger.warn(`Could not read save directory: ${config.saveMountPath}`);
  }

  return { assetPaths, characterHexNames };
}

// ── Direct asset extraction ────────────────────────────────────────

function extractDirectRefs(char: Record<string, unknown>): AssetRef[] {
  const refs: AssetRef[] = [];

  // 1. Main image
  const image = str(char.image);
  if (image && !isSkippableUri(image)) {
    refs.push({ field: 'image', name: 'main', path: image });
  }

  // 2. emotionImages: [emotionName, assetPath][]
  if (Array.isArray(char.emotionImages)) {
    for (const entry of char.emotionImages) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const p = str(entry[1]);
      if (p && !isSkippableUri(p)) {
        refs.push({ field: 'emotionImages', name: str(entry[0]), path: p });
      }
    }
  }

  // 3. additionalAssets: [assetName, assetPath, ext][]
  if (Array.isArray(char.additionalAssets)) {
    for (const entry of char.additionalAssets) {
      if (!Array.isArray(entry) || entry.length < 2) continue;
      const p = str(entry[1]);
      if (p && !isSkippableUri(p)) {
        refs.push({ field: 'additionalAssets', name: str(entry[0]), path: p });
      }
    }
  }

  // 4. ccAssets: {type, uri, name, ext}[]
  if (Array.isArray(char.ccAssets)) {
    for (const entry of char.ccAssets) {
      if (!isRecord(entry)) continue;
      const uri = str(entry.uri);
      if (uri && !isSkippableUri(uri)) {
        refs.push({ field: 'ccAssets', name: str(entry.name), path: uri });
      }
    }
  }

  return refs;
}

// ── Asset name → path mapping ──────────────────────────────────────

type AssetMap = Map<string, string>;

function buildCharacterAssetMap(char: Record<string, unknown>): AssetMap {
  const map: AssetMap = new Map();

  if (Array.isArray(char.additionalAssets)) {
    for (const entry of char.additionalAssets) {
      if (Array.isArray(entry) && entry.length >= 2) {
        map.set(str(entry[0]).toLowerCase(), str(entry[1]));
      }
    }
  }

  if (Array.isArray(char.emotionImages)) {
    for (const entry of char.emotionImages) {
      if (Array.isArray(entry) && entry.length >= 2) {
        map.set(str(entry[0]).toLowerCase(), str(entry[1]));
      }
    }
  }

  return map;
}

// ── Template reference extraction ──────────────────────────────────

function extractTemplateRefs(
  char: Record<string, unknown>,
  charAssetMap: AssetMap,
  moduleAssetMap: AssetMap,
): AssetRef[] {
  const refs: AssetRef[] = [];
  const seen = new Set<string>();

  const combinedMap: AssetMap = new Map([...moduleAssetMap, ...charAssetMap]);

  function scanText(text: string, fieldName: string): void {
    ASSET_TEMPLATE_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = ASSET_TEMPLATE_REGEX.exec(text)) !== null) {
      const assetName = match[1];
      const dedupeKey = `${fieldName}:${assetName.toLowerCase()}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const resolvedPath = combinedMap.get(assetName.toLowerCase()) ?? '';
      refs.push({
        field: `template:${fieldName}`,
        name: assetName,
        path: resolvedPath,
      });
    }
  }

  for (const field of TEXT_FIELDS) {
    const value = char[field];
    if (typeof value === 'string') scanText(value, field);
  }

  // alternateGreetings: string[]
  if (Array.isArray(char.alternateGreetings)) {
    for (const greeting of char.alternateGreetings) {
      if (typeof greeting === 'string') scanText(greeting, 'alternateGreetings');
    }
  }

  // group_only_greetings: string[]
  if (Array.isArray(char.group_only_greetings)) {
    for (const greeting of char.group_only_greetings) {
      if (typeof greeting === 'string') scanText(greeting, 'group_only_greetings');
    }
  }

  // globalLore (lorebook): { content?: string }[]
  if (Array.isArray(char.globalLore)) {
    for (const lore of char.globalLore) {
      if (isRecord(lore) && typeof lore.content === 'string') {
        scanText(lore.content, 'lorebook');
      }
    }
  }

  return refs;
}

// ── Module loading ─────────────────────────────────────────────────

interface RisuModule {
  name: string;
  id: string;
  assets?: [string, string, string][];
  lorebook?: Array<{ content?: string }>;
}

interface SqlReadResult {
  type: 'read';
  rows: Record<string, unknown>[];
}

function isModuleArray(value: unknown): value is RisuModule[] {
  return Array.isArray(value) && value.every(
    (v) => isRecord(v) && typeof v.name === 'string' && typeof v.id === 'string',
  );
}

async function loadModules(): Promise<RisuModule[]> {
  if (!config.sqliteUrl) return [];

  try {
    const res = await fetch(`${config.sqliteUrl}/_internal/sql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: "SELECT name, data FROM blocks WHERE type = 5 AND source = 'database.bin'",
      }),
    });

    if (!res.ok) return [];

    const result: unknown = await res.json();
    if (!isRecord(result) || result.type !== 'read' || !Array.isArray(result.rows)) return [];

    const modules: RisuModule[] = [];
    for (const row of result.rows) {
      if (!isRecord(row) || typeof row.data !== 'string') continue;
      try {
        const parsed: unknown = JSON.parse(row.data);
        if (isModuleArray(parsed)) {
          modules.push(...parsed);
        } else if (isRecord(parsed) && typeof parsed.name === 'string') {
          modules.push(parsed as unknown as RisuModule);
        }
      } catch {
        // skip unparseable blocks
      }
    }

    return modules;
  } catch {
    logger.warn('Could not fetch module data from with-sqlite');
    return [];
  }
}

/** with-sqlite의 characters 테이블에서 소프트 딜리트되지 않은 char_id 목록을 가져온다. */
async function fetchActiveCharacterIds(): Promise<Set<string> | null> {
  if (!config.sqliteUrl) return null;

  try {
    const res = await fetch(`${config.sqliteUrl}/_internal/sql/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sql: 'SELECT char_id FROM characters WHERE __ws_deleted_at IS NULL',
      }),
    });

    if (!res.ok) return null;

    const result: unknown = await res.json();
    if (!isRecord(result) || result.type !== 'read' || !Array.isArray(result.rows)) return null;

    const ids = new Set<string>();
    for (const row of result.rows) {
      if (isRecord(row) && typeof row.char_id === 'string') {
        ids.add(row.char_id);
      }
    }
    return ids;
  } catch {
    logger.warn('Could not fetch active character IDs from with-sqlite');
    return null;
  }
}

function buildModuleAssetMap(modules: RisuModule[]): AssetMap {
  const map: AssetMap = new Map();
  for (const mod of modules) {
    if (!Array.isArray(mod.assets)) continue;
    for (const entry of mod.assets) {
      if (Array.isArray(entry) && entry.length >= 2) {
        map.set(str(entry[0]).toLowerCase(), str(entry[1]));
      }
    }
  }
  return map;
}

function validateModules(
  modules: RisuModule[],
  existingAssets: Set<string>,
  moduleAssetMap: AssetMap,
): ModuleIssues[] {
  const results: ModuleIssues[] = [];

  for (const mod of modules) {
    const directRefs: AssetRef[] = [];
    if (Array.isArray(mod.assets)) {
      for (const entry of mod.assets) {
        if (Array.isArray(entry) && entry.length >= 2) {
          const p = str(entry[1]);
          if (p && !isSkippableUri(p)) {
            directRefs.push({ field: 'assets', name: str(entry[0]), path: p });
          }
        }
      }
    }

    // Template refs in lorebook
    const templateRefs: AssetRef[] = [];
    if (Array.isArray(mod.lorebook)) {
      const seen = new Set<string>();
      for (const lore of mod.lorebook) {
        if (!isRecord(lore) || typeof lore.content !== 'string') continue;

        ASSET_TEMPLATE_REGEX.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = ASSET_TEMPLATE_REGEX.exec(lore.content)) !== null) {
          const assetName = match[1];
          if (seen.has(assetName.toLowerCase())) continue;
          seen.add(assetName.toLowerCase());

          const resolvedPath = moduleAssetMap.get(assetName.toLowerCase()) ?? '';
          templateRefs.push({
            field: 'template:lorebook',
            name: assetName,
            path: resolvedPath,
          });
        }
      }
    }

    const allRefs = [...directRefs, ...templateRefs];
    const issues: AssetIssue[] = [];

    for (const ref of allRefs) {
      const exists = ref.path ? existingAssets.has(ref.path) : false;
      if (!exists) {
        issues.push({ field: ref.field, assetName: ref.name, assetPath: ref.path });
      }
    }

    results.push({
      moduleId: mod.id,
      moduleName: mod.name,
      totalAssets: allRefs.length,
      issues,
    });
  }

  return results;
}

// ── Main validation ────────────────────────────────────────────────

export async function runValidation(): Promise<ValidationResult> {
  const [saveScan, activeCharIds] = await Promise.all([
    scanSaveDirectory(),
    fetchActiveCharacterIds(),
  ]);
  const { assetPaths: existingAssets, characterHexNames } = saveScan;
  logger.info(
    `Asset validator: ${existingAssets.size} assets, ${characterHexNames.length} character files, ` +
      `${activeCharIds ? activeCharIds.size : '?'} active in DB`,
  );

  // Load modules for template resolution + module validation
  const modules = await loadModules();
  const moduleAssetMap = buildModuleAssetMap(modules);

  const characters: CharacterIssues[] = [];
  let totalAssets = 0;
  let totalMissing = 0;

  // Process character files one at a time to limit memory
  for (const hexName of characterHexNames) {
    try {
      const filePath = path.join(config.saveMountPath, hexName);
      const content = await readFile(filePath, 'utf-8');
      const data: unknown = JSON.parse(content);
      if (!isRecord(data)) continue;

      const decoded = hexDecode(hexName) ?? hexName;
      // "remotes/{charId}.local.bin" → charId
      const charId = decoded.replace(/^remotes\//, '').replace(/\.local\.bin$/, '');

      // with-sqlite에서 소프트 딜리트된 캐릭터는 제외
      if (activeCharIds && !activeCharIds.has(charId)) continue;
      const charName = str(data.name) || charId;
      const charType = str(data.type) || 'character';

      const directRefs = extractDirectRefs(data);
      const charAssetMap = buildCharacterAssetMap(data);
      const templateRefs = extractTemplateRefs(data, charAssetMap, moduleAssetMap);
      const allRefs = [...directRefs, ...templateRefs];

      const issues: AssetIssue[] = [];
      for (const ref of allRefs) {
        totalAssets++;
        const exists = ref.path ? existingAssets.has(ref.path) : false;
        if (!exists) {
          totalMissing++;
          issues.push({ field: ref.field, assetName: ref.name, assetPath: ref.path });
        }
      }

      characters.push({
        characterId: charId,
        characterName: charName,
        type: charType,
        totalAssets: allRefs.length,
        issues,
      });
    } catch {
      // skip malformed files
    }
  }

  // Validate modules
  const moduleResults = validateModules(modules, existingAssets, moduleAssetMap);
  for (const mod of moduleResults) {
    totalAssets += mod.totalAssets;
    totalMissing += mod.issues.length;
  }

  logger.info(
    `Asset validator: ${characters.length} characters, ${modules.length} modules, ` +
      `${totalAssets} refs, ${totalMissing} missing`,
  );

  return {
    totalCharacters: characters.length,
    totalAssets,
    totalMissing,
    characters,
    modules: moduleResults,
    scannedAt: Date.now(),
  };
}
