import type { CardAgentInfo } from '@/lib/card-agents/card-agents';

/** What the card agent panel gives the body of the chosen task. */
export interface CardAgentBodyProps {
  engagementId: string;
  /** The card the panel sits on. */
  stepId?: string | null;
  obligationId?: string | null;
  /** The obligation instance (one client's filing period), when the card is a filing. */
  instanceId?: string | null;
  task: CardAgentInfo;
  onClose: () => void;
  /**
   * Browser route: the "Before I fill" keys the person chose to type on the portal themselves
   * ("I type on the portal"); the agent leaves those fields and marks them (G16).
   */
  typeOnPortal?: string[];
  /** The client's name, for the body's own head lines. */
  companyName?: string;
}
