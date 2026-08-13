import Link from 'next/link';
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
          <div className="relative flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Link href={ROUTES.DISCOVER_TYPE('profiles')} className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto">
                <Search className="w-4 h-4 mr-2" /> Discover People
              </Button>
            </Link>
            <Button
              onClick={onToggleShare}
              className="w-full bg-fg-primary text-fg-inverted hover:bg-muted-strong sm:w-auto"
            >
              <Share2 className="w-4 h-4 mr-2" /> Share My Profile
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
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
              <div className="absolute right-0 top-full z-50 mt-2 max-w-[calc(100vw-2rem)]">
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
