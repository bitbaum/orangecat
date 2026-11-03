import { getFleetProject } from '@/domain/projectRooms/evidence/loki';
import { RoomIdentity, RoomRoadmap, RoomShipping } from '@/components/room/RoomEvidence';

/** The same canonical product record on the public project and its private room. */
export async function ProjectProductRecord({ projectId }: { projectId: string }) {
  const record = await getFleetProject(projectId);
  if (!record) {
    return null;
  }
  return (
    <section aria-label="Product record">
      <RoomIdentity fleet={record} />
      <RoomShipping fleet={record} pace={null} />
      <RoomRoadmap fleet={record} />
    </section>
  );
}
