import { useState } from 'react';
import { usePanel } from './use-panel';
import { Robot, type RobotMood } from './Robot';
import { RunView } from './RunView';
import { TERMINAL } from '../engine/machine';
import { LIVE_BLOCKED_MESSAGE } from '../engine/live';
import type { PanelCommand, PanelState } from '../shared/messages';
import type { CatalogAgent, CatalogNode, CatalogSubAgent } from '../shared/types';
import { MOCK_ONLY_NOTE, catalogTree, packIsLive, taskChips, tasksIn, trail, type TaskChip } from './tree';
import { Chip, EmptyState, Section, type ChipTone } from './spectrum';

/** One colour per agent, from the Spectrum data palette (data-1..6, the same in both themes). */
export const AGENT_COLORS: Record<string, string> = {
  incorporation: 'var(--data-2)',
  'post-incorporation': 'var(--data-1)',
  registration: 'var(--data-3)',
  compliance: 'var(--data-5)',
};
const DATA = ['var(--data-2)', 'var(--data-1)', 'var(--data-3)', 'var(--data-5)', 'var(--data-4)', 'var(--data-6)'];
const colorFor = (id: string, i: number) => AGENT_COLORS[id] ?? DATA[i % DATA.length]!;

/** The task status chips in the six-word tones (spectrum-chip.tsx): Ready is done-green, Beta in progress, Later not started. */
const TASK_TONE: Record<TaskChip['tone'], ChipTone> = { positive: 'ok', brand: 'prog', muted: 'idle', warn: 'teal' };

export function App() {
  const { state, send } = usePanel();
  if (!state) {
    return (
      <main className="panel">
        <EmptyState title="Connecting to VCFO Assist…" />
      </main>
    );
  }
  const run = state.run;
  return (
    <main className="panel">
      <Header state={state} send={send} />
      {state.notice && (
        <p className="notice" role="alert">
          {state.notice}
        </p>
      )}
      {run ? <RunView state={state} run={run} send={send} agentColor={colorFor(run.agentId, 0)} /> : <Home state={state} send={send} />}
    </main>
  );
}

function Header({ state, send }: { state: PanelState; send: (c: PanelCommand) => void }) {
  const running = state.run && !TERMINAL.has(state.run.state);
  return (
    <header className="head wash">
      <div className="head-row">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">V</span>
          <span>
            <strong>VCFO Assist</strong>
            <span className="brand-sub">Agents</span>
          </span>
        </div>
        <button
          type="button"
          className={`conn ${state.suite.connected ? 'on' : 'off'}`}
          onClick={() => send({ cmd: 'refresh' })}
          title={state.suite.connected ? `Connected to ${state.suite.origin}` : state.suite.error ?? 'Not connected'}
        >
          <span className="dot" aria-hidden="true" />
          {state.suite.connected ? 'Connected' : 'Not connected'}
        </button>
      </div>
      <label className="picker">
        <span className="picker-label">Client</span>
        <select
          value={state.engagementId ?? ''}
          disabled={!state.suite.connected || Boolean(running)}
          onChange={(e) => send({ cmd: 'selectEngagement', id: e.target.value })}
        >
          <option value="">{state.suite.connected ? 'Pick a client…' : 'Open VCFO Suite to load clients'}</option>
          {state.engagements.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>
      {!state.suite.connected && state.suite.error && <p className="wash-note small">{state.suite.error}</p>}
    </header>
  );
}

function Home({ state, send }: { state: PanelState; send: (c: PanelCommand) => void }) {
  const [agentId, setAgentId] = useState<string>(state.catalog.agents[0]?.id ?? '');
  // G14: asked once and remembered; a user id or email label for the evidence log, never a password.
  const [mcaLogin, setMcaLogin] = useState<string>(state.settings.mcaLogin ?? '');
  const agent = state.catalog.agents.find((a) => a.id === agentId);
  const tree = catalogTree(state.catalog);
  const agentNode = tree.find((n) => n.id === agentId);
  // Every group starts open (also groups a later catalog adds); the person collapses what they do not need.
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const open = new Set(allGroupIds(tree).filter((id) => !closed.has(id)));
  const [focus, setFocus] = useState<string>('');
  const portal = state.portal;
  return (
    <>
      <Section title="Agents">
        <div className="grid" role="list">
          {state.catalog.agents.map((a, i) => (
            <AgentTile key={a.id} agent={a} color={colorFor(a.id, i)} selected={a.id === agentId} onSelect={() => setAgentId(a.id)} />
          ))}
        </div>
      </Section>

      <Section title="Portal tab">
        {portal.tabId ? (
          <p className="portal-line">
            <Chip tone={portal.mock ? 'idle' : 'bad'}>{portal.mock ? 'Mock' : 'Live'}</Chip>
            <span className="mono">{portal.host}</span>
          </p>
        ) : (
          <EmptyState title="Open the portal form (or the mock portal) in a tab." />
        )}
        {portal.tabId && !portal.liveAllowed && (
          <p className="warn small" role="status">
            {LIVE_BLOCKED_MESSAGE}
          </p>
        )}
      </Section>

      <section className="card card-pad">
        <label className="picker">
          <span className="picker-label">Which MCA login are you using?</span>
          <input
            type="text"
            className="mono"
            data-testid="mca-login"
            autoComplete="off"
            maxLength={120}
            placeholder="Your MCA user ID or email (never the password)"
            value={mcaLogin}
            onChange={(e) => setMcaLogin(e.target.value)}
          />
        </label>
        <p className="muted small">Kept on the run as evidence of who filed. Use your own login only.</p>
      </section>

      {agent && agentNode && (
        <Section title={`${agent.name}: sub-agents and tasks`} data-testid="task-tree" bodyClassName="flush">
          <nav className="crumbs small" aria-label="Where you are">
            {trail(tree, focus || agent.id).map((n, i, all) => (
              <span key={n.id}>
                <button type="button" className="link crumb" onClick={() => setFocus(n.id)}>
                  {n.name}
                </button>
                {i < all.length - 1 && <span aria-hidden="true"> › </span>}
              </span>
            ))}
          </nav>
          <TaskList
            nodes={agentNode.type === 'group' ? agentNode.children : [agentNode]}
            depth={1}
            open={open}
            toggle={(id) => {
              setFocus(id);
              setClosed((cur) => {
                const next = new Set(cur);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              });
            }}
            renderTask={(s) => <TaskRow key={s.id} task={s} agentId={agent.id} state={state} send={send} mcaLogin={mcaLogin} onFocus={() => setFocus(s.id)} />}
          />
        </Section>
      )}

      <Settings state={state} send={send} />
    </>
  );
}

function allGroupIds(nodes: CatalogNode[]): string[] {
  return nodes.flatMap((n) => (n.type === 'group' ? [n.id, ...allGroupIds(n.children)] : []));
}

/** Nested lists: a group expands and collapses; a task is a row with its chips and Run button. */
function TaskList({
  nodes,
  depth,
  open,
  toggle,
  renderTask,
}: {
  nodes: CatalogNode[];
  depth: number;
  open: Set<string>;
  toggle: (id: string) => void;
  renderTask: (task: CatalogSubAgent) => React.ReactNode;
}) {
  return (
    <ul className={`subs tree depth-${Math.min(depth, 4)}`} role={depth === 1 ? 'tree' : 'group'}>
      {nodes.map((n) => {
        if (n.type === 'task') {
          const { type: _type, ...task } = n;
          return renderTask(task);
        }
        const expanded = open.has(n.id);
        const tasks = tasksIn(n);
        const built = tasks.filter((t) => t.recipeId).length;
        return (
          <li key={n.id} className="tree-group" role="treeitem" aria-expanded={expanded}>
            <button type="button" className="tree-toggle" onClick={() => toggle(n.id)} data-testid={`group-${n.id}`}>
              <span className="caret" aria-hidden="true">{expanded ? '▾' : '▸'}</span> <strong>{n.name}</strong>{' '}
              <span className="muted small">
                {built} of {tasks.length} built
              </span>
            </button>
            {expanded && <TaskList nodes={n.children} depth={depth + 1} open={open} toggle={toggle} renderTask={renderTask} />}
          </li>
        );
      })}
    </ul>
  );
}

function TaskRow({
  task: s,
  agentId,
  state,
  send,
  mcaLogin,
  onFocus,
}: {
  task: CatalogSubAgent;
  agentId: string;
  state: PanelState;
  send: (c: PanelCommand) => void;
  mcaLogin: string;
  onFocus: () => void;
}) {
  const portal = state.portal;
  const ready = Boolean(s.recipeId);
  const r = state.readiness?.engagementId === state.engagementId ? state.readiness : undefined;
  const missing = r?.missing.length ?? 0;
  const chips = taskChips(s, state.catalog);
  return (
    <li className="sub" role="treeitem" data-testid={`task-${s.id}`} onFocus={onFocus}>
      <div className="sub-main">
        <strong>{s.name}</strong>
        <span className="chips">
          {chips.map((c) => (
            <Chip key={c.label} tone={TASK_TONE[c.tone]}>
              {c.label}
            </Chip>
          ))}
          {ready &&
            (!state.engagementId ? (
              <Chip tone="idle">Pick a client</Chip>
            ) : !r ? (
              <Chip tone="prog">Checking…</Chip>
            ) : r.error ? (
              <Chip tone="bad" title={r.error}>
                Profile not loaded
              </Chip>
            ) : missing === 0 ? (
              <Chip tone="ok">Data ready</Chip>
            ) : (
              <button type="button" className="chip chip-bad link" onClick={() => send({ cmd: 'openSuite', stepId: r.missing.find((m) => m.stepId)?.stepId ?? s.stepId })} title={r.missing.map((m) => m.label).join(', ')}>
                <i className="chip-dot" aria-hidden="true" />
                {missing} missing → Fix in Suite
              </button>
            ))}
        </span>
        {s.note && <span className="muted small">{s.note}</span>}
        {s.pack && !packIsLive(s, state.catalog) && <span className="muted small">{MOCK_ONLY_NOTE}</span>}
      </div>
      {ready && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!state.engagementId || !portal.tabId || !portal.liveAllowed || !mcaLogin.trim()}
          onClick={() => send({ cmd: 'start', agentId, subAgentId: s.id, mcaLoginLabel: mcaLogin.trim() })}
        >
          Run
        </button>
      )}
    </li>
  );
}

function AgentTile({ agent, color, selected, onSelect }: { agent: CatalogAgent; color: string; selected: boolean; onSelect: () => void }) {
  const built = agent.subAgents.filter((s) => s.recipeId).length;
  const mood: RobotMood = 'idle';
  return (
    <button type="button" role="listitem" className={`tile ${selected ? 'selected' : ''}`} style={{ ['--agent' as string]: color }} onClick={onSelect} aria-pressed={selected}>
      <span className="robot-well">
        <Robot color={color} mood={mood} size={48} label={`${agent.name} agent`} />
      </span>
      <span className="tile-name">{agent.name}</span>
      <span className="tile-sub">{built ? `${built} of ${agent.subAgents.length} ready` : 'Coming soon'}</span>
    </button>
  );
}

function Settings({ state, send }: { state: PanelState; send: (c: PanelCommand) => void }) {
  const [text, setText] = useState(state.settings.suiteOrigins.join('\n'));
  return (
    <Section as="details" title="Settings" className="settings">
      <label className="small field">
        Suite origins (one per line). The extension reads data only through an open, signed-in tab on one of these.
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} className="mono" />
      </label>
      <div>
        <button type="button" className="btn" onClick={() => send({ cmd: 'setOrigins', origins: text.split(/\s+/).filter(Boolean) })}>
          Save
        </button>
      </div>
    </Section>
  );
}
