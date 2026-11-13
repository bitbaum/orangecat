import Button from '@/components/ui/Button';
import ProfileShare from '@/components/sharing/ProfileShare';
import { Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { GRADIENTS } from '@/config/gradients';

interface InviteBannerProps {
  showShare: boolean;
  onToggleShare: () => void;
  onCloseShare: () => void;
  profileUrl: string;
  profileUsername: string;
  profileName: string;
  profileBio?: string;
}

/**
 * Invite card: two equal cells, Copy link and Share (the ReceiveCode pattern).
 * Three nowrap buttons in nested rows ran off a 390px screen, leaving "Copy
 * Link" unreachable; the third, Discover People, repeated the header's action.
 */
export default function InviteBanner({
  showShare,
  onToggleShare,
  onCloseShare,
  profileUrl,
  profileUsername,
  profileName,
  profileBio,
}: InviteBannerProps) {
  return (
    <div className="mb-6">
      <div
        className={`rounded-lg border border-subtle ${GRADIENTS.sectionOrangeTiffany} p-4 sm:p-5 shadow-sm`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="font-semibold text-fg-primary">Invite friends to OrangeCat</h3>
            <p className="mb-0 text-sm text-fg-secondary">
              Share your profile link and start building your network
            </p>
          </div>
          <div className="relative grid w-full grid-cols-2 gap-2 sm:w-auto">
            <Button
              variant="outline"
              className="min-w-0"
              onClick={() => {
                navigator.clipboard
                  .writeText(profileUrl)
                  .then(() => {
                    toast.success('Invite link copied');
                  })
                  .catch(() => toast.error('Failed to copy link'));
              }}
            >
              <Copy className="w-4 h-4 mr-2" aria-hidden="true" /> Copy link
            </Button>
            <Button variant="outline" className="min-w-0" onClick={onToggleShare}>
              <Share2 className="w-4 h-4 mr-2" aria-hidden="true" /> Share
            </Button>
            {showShare && (
              <div className="absolute right-0 top-full mt-2 z-50">
                <ProfileShare
                  username={profileUsername}
                  profileName={profileName}
                  profileBio={profileBio}
                  onClose={onCloseShare}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
