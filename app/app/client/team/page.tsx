import ClientTeamPage from "@/views/client/ClientTeam";
import { ClientTeamEntry } from "@/components/client-portal/pages/team";

export default function Page() {
  return <ClientTeamEntry legacy={<ClientTeamPage />} />;
}
