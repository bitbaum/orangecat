import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import type { EntityDetailConfig } from '@/components/public/PublicEntityDetailPage';
import { ROUTES } from '@/config/routes';

/**
 * SSOT for the circle detail page — shared by the public route (/circles/[id])
 * and the owner dashboard route (/dashboard/circles/[id]). Circles are a light
 * community structure: no payment, the facts that matter are members / visibility
 * / category. (Enriched from the previously bare public config, which showed only
 * the description; the owner dashboard's flat grid surfaced these facts and they
 * belong on the page itself.)
 */
export const circleDetailConfig: EntityDetailConfig = {
  entityType: 'circle',
  ownerLabel: 'Created by',
  metadataSelect: 'title, description',
  showPaymentSection: false,
  getViewRoute: id => ROUTES.CIRCLES.VIEW(id),
  renderHeaderExtra: entity =>
    entity.category ? (
      <Badge variant="outline" className="capitalize">
        {entity.category as string}
      </Badge>
    ) : null,
  renderDetails: entity => {
    const memberCount = entity.member_count as number | null | undefined;
    const visibility = entity.visibility as string | undefined;
    const category = entity.category as string | undefined;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-fg-secondary">Members</span>
            <span className="font-medium">{memberCount ?? 0}</span>
          </div>
          {visibility && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-secondary">Visibility</span>
              <span className="font-medium capitalize">{visibility}</span>
            </div>
          )}
          {category && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-fg-secondary">Category</span>
              <span className="font-medium capitalize">{category}</span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  },
};
