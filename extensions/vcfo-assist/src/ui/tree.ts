/**
 * The catalog tree the panel shows: agent → sub-agent → … → task, with a status chip per task.
 * Pure, so it is tested. Suite sends the tree (`catalog.tree`); an older Suite sends only the flat
 * `agents`, and then each agent's tasks sit directly under it.
 */
import type { Catalog, CatalogNode, CatalogSubAgent } from '../shared/types';

export type TaskChip = { label: 'Ready' | 'Beta' | 'Later' | 'Needs CS opinion'; tone: 'positive' | 'brand' | 'muted' | 'warn' };

export function catalogTree(catalog: Catalog): CatalogNode[] {
  if (catalog.tree?.length) return catalog.tree;
  return catalog.agents.map((a) => ({ type: 'group', id: a.id, name: a.name, children: a.subAgents.map((s) => ({ type: 'task' as const, ...s })) }));
}

/** Every task under a node, in order. */
export function tasksIn(node: CatalogNode): CatalogSubAgent[] {
  if (node.type === 'task') {
    const { type: _type, ...task } = node;
    return [task];
  }
  return node.children.flatMap(tasksIn);
}

/** The nodes from the top to the node with this id (the breadcrumb), or [] when absent. */
export function trail(nodes: CatalogNode[], id: string): CatalogNode[] {
  for (const n of nodes) {
    if (n.id === id) return [n];
    if (n.type === 'group') {
      const below = trail(n.children, id);
      if (below.length) return [n, ...below];
    }
  }
  return [];
}

/** The status chips for one task: Ready, Beta or Later, plus "Needs CS opinion" for GST-like packs. */
export function taskChips(task: CatalogSubAgent, catalog: Catalog): TaskChip[] {
  const chips: TaskChip[] = [];
  const status = task.status ?? (task.recipeId ? 'beta' : 'later');
  chips.push(status === 'ready' ? { label: 'Ready', tone: 'positive' } : status === 'beta' ? { label: 'Beta', tone: 'brand' } : { label: 'Later', tone: 'muted' });
  const pack = catalog.packs?.find((p) => p.id === task.pack);
  if (pack?.needsCsOpinionFirst && pack.legalStatus !== 'cs-cleared') chips.push({ label: 'Needs CS opinion', tone: 'warn' });
  return chips;
}

/** True when the task's pack may run on its live portal (cs-cleared and switched on in Suite). */
export function packIsLive(task: CatalogSubAgent, catalog: Catalog): boolean {
  const pack = catalog.packs?.find((p) => p.id === task.pack);
  return Boolean(pack?.live && pack.legalStatus === 'cs-cleared');
}

export const MOCK_ONLY_NOTE = 'Mock only until the CS opinion';
