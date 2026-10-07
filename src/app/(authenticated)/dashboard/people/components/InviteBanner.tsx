import Button from '@/components/ui/Button';
import ProfileShare from '@/components/sharing/ProfileShare';
import { Search, Share2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { GRADIENTS } from '@/config/gradients';
import { ROUTES } from '@/config/routes';

interface InviteBannerProps {
  showShare: boolean;
  onToggleShare: () => void;
  onCloseShare: () => void;
  profileUrl: string;
  profileUsername: string;
  profileName: string;
  profileBio?: string;
}

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-fg-primary">Invite friends to OrangeCat</h3>
            <p className="text-sm text-fg-secondary">
              Share your profile link and start building your network
            </p>
          </div>
          <div className="flex items-center gap-2 relative">
            <Button href={`${ROUTES.DISCOVER}?section=people`} variant="outline">
              <Search className="w-4 h-4 mr-2" /> Discover People
            </Button>
            <div className="flex items-center gap-2 relative">
              <Button
                onClick={onToggleShare}
                className="bg-fg-primary hover:bg-muted-strong text-fg-inverted"
              >
                <Share2 className="w-4 h-4 mr-2" /> Share My Profile
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard
                    .writeText(profileUrl)
                    .then(() => {
                      toast.success('Invite link copied');
                    })
                    .catch(() => toast.error('Failed to copy link'));
                }}
              >
                <Copy className="w-4 h-4 mr-2" /> Copy Link
              </Button>
              {showShare && (
                <div className="absolute right-0 mt-2 z-50">
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
    </div>
  );
}
